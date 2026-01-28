import { v4 as uuidv4 } from 'uuid';
import type {
  ClassificationInput,
  ClassificationResult,
  ComparisonRequest,
  ComparisonResult,
  DutyCalculation,
} from '../types/classification.js';
import {
  classifyWithAnthropic,
  classifyWithOpenAI,
  classifyWithZonos,
  calculateDutyWithZonos,
} from './classifiers/index.js';

// In-memory storage for comparison results (replace with DB in production)
const comparisonResults: Map<string, ComparisonResult> = new Map();

export async function runComparison(request: ComparisonRequest): Promise<ComparisonResult> {
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  const providers = request.providers || ['anthropic', 'openai', 'zonos'];
  const shipToCountry = request.shipToCountry || 'FR';

  const input: ClassificationInput = {
    imageBase64: request.imageBase64,
    imageUrl: request.imageUrl,
    productName: request.productName,
    productDescription: request.productDescription,
    originCountry: request.originCountry,
    shipToCountry,
  };

  // Run all classifications in parallel
  const classificationPromises: Promise<ClassificationResult>[] = [];

  if (providers.includes('anthropic')) {
    classificationPromises.push(classifyWithAnthropic(input));
  }
  if (providers.includes('openai')) {
    classificationPromises.push(classifyWithOpenAI(input));
  }
  if (providers.includes('zonos')) {
    classificationPromises.push(classifyWithZonos(input));
  }

  const classificationResults = await Promise.all(classificationPromises);

  // Organize results by provider
  const classifications: ComparisonResult['classifications'] = {};
  for (const result of classificationResults) {
    classifications[result.provider] = result;
  }

  // Calculate duties if requested and we have a product value
  let dutyCalculations: ComparisonResult['dutyCalculations'] | undefined;

  if (request.calculateDuty && request.productValue) {
    dutyCalculations = {};

    const dutyPromises: Promise<DutyCalculation>[] = [];
    const dutyProviders: Array<'anthropic' | 'openai' | 'zonos'> = [];

    // Calculate duty for each provider's HS code using Zonos Landed Cost
    for (const provider of ['anthropic', 'openai', 'zonos'] as const) {
      const classification = classifications[provider];
      if (classification?.hsCode && !classification.error) {
        dutyProviders.push(provider);
        dutyPromises.push(
          calculateDutyWithZonos(
            classification.hsCode,
            request.productValue,
            request.currency || 'EUR',
            request.originCountry || 'US',
            shipToCountry
          ).then((duty) => ({ ...duty, provider }))
        );
      }
    }

    const dutyResults = await Promise.all(dutyPromises);
    for (let i = 0; i < dutyResults.length; i++) {
      dutyCalculations[dutyProviders[i]] = dutyResults[i];
    }
  }

  // Analyze results
  const analysis = analyzeResults(classifications, dutyCalculations);

  const result: ComparisonResult = {
    id,
    timestamp,
    input,
    productValue: request.productValue,
    currency: request.currency || 'EUR',
    classifications,
    dutyCalculations,
    analysis,
  };

  // Store result
  comparisonResults.set(id, result);

  return result;
}

function analyzeResults(
  classifications: ComparisonResult['classifications'],
  dutyCalculations?: ComparisonResult['dutyCalculations']
): ComparisonResult['analysis'] {
  const anthropic = classifications.anthropic;
  const openai = classifications.openai;
  const zonos = classifications.zonos;

  // HS Code matching analysis
  const hsCodeMatch = {
    anthropicVsZonos: anthropic?.hsCode === zonos?.hsCode,
    openaiVsZonos: openai?.hsCode === zonos?.hsCode,
    anthropicVsOpenai: anthropic?.hsCode === openai?.hsCode,
    hs6Match: {
      anthropicVsZonos: anthropic?.hsCode6 === zonos?.hsCode6,
      openaiVsZonos: openai?.hsCode6 === zonos?.hsCode6,
      anthropicVsOpenai: anthropic?.hsCode6 === openai?.hsCode6,
    },
  };

  // Confidence scores
  const confidenceScores: ComparisonResult['analysis']['confidenceScores'] = {};
  if (anthropic?.confidence) confidenceScores.anthropic = anthropic.confidence;
  if (openai?.confidence) confidenceScores.openai = openai.confidence;
  if (zonos?.confidence) confidenceScores.zonos = zonos.confidence;

  // Duty difference analysis
  let dutyDifference: ComparisonResult['analysis']['dutyDifference'] | undefined;
  if (dutyCalculations) {
    dutyDifference = {};
    const anthropicDuty = dutyCalculations.anthropic?.totalLandedCost;
    const openaiDuty = dutyCalculations.openai?.totalLandedCost;
    const zonosDuty = dutyCalculations.zonos?.totalLandedCost;

    if (anthropicDuty && zonosDuty) {
      dutyDifference.anthropicVsZonos = Math.abs(anthropicDuty - zonosDuty);
    }
    if (openaiDuty && zonosDuty) {
      dutyDifference.openaiVsZonos = Math.abs(openaiDuty - zonosDuty);
    }
    if (anthropicDuty && openaiDuty) {
      dutyDifference.anthropicVsOpenai = Math.abs(anthropicDuty - openaiDuty);
    }
  }

  // Determine winner (based on matching Zonos + confidence)
  let winner: 'anthropic' | 'openai' | 'tie' | undefined;
  const anthropicScore = calculateProviderScore(anthropic, zonos, hsCodeMatch.anthropicVsZonos, hsCodeMatch.hs6Match.anthropicVsZonos);
  const openaiScore = calculateProviderScore(openai, zonos, hsCodeMatch.openaiVsZonos, hsCodeMatch.hs6Match.openaiVsZonos);

  if (anthropicScore > openaiScore) {
    winner = 'anthropic';
  } else if (openaiScore > anthropicScore) {
    winner = 'openai';
  } else if (anthropicScore === openaiScore && anthropicScore > 0) {
    winner = 'tie';
  }

  // Generate notes
  const notes = generateAnalysisNotes(classifications, hsCodeMatch, dutyDifference);

  return {
    hsCodeMatch,
    confidenceScores,
    dutyDifference,
    winner,
    notes,
  };
}

function calculateProviderScore(
  result: ClassificationResult | undefined,
  zonos: ClassificationResult | undefined,
  exactMatch: boolean,
  hs6Match: boolean
): number {
  if (!result || result.error) return 0;

  let score = 0;

  // Exact HS code match with Zonos = 3 points
  if (exactMatch) score += 3;
  // HS6 match = 2 points
  else if (hs6Match) score += 2;

  // Confidence bonus (0-1 points)
  score += result.confidence || 0;

  return score;
}

function generateAnalysisNotes(
  classifications: ComparisonResult['classifications'],
  hsCodeMatch: ComparisonResult['analysis']['hsCodeMatch'],
  dutyDifference?: ComparisonResult['analysis']['dutyDifference']
): string {
  const notes: string[] = [];

  // HS code comparison
  if (hsCodeMatch.anthropicVsZonos && hsCodeMatch.openaiVsZonos) {
    notes.push('All providers returned the same HS code.');
  } else if (hsCodeMatch.hs6Match.anthropicVsZonos && hsCodeMatch.hs6Match.openaiVsZonos) {
    notes.push('All providers agree on HS6 (first 6 digits), differ on full code.');
  } else {
    const matches: string[] = [];
    if (hsCodeMatch.anthropicVsZonos) matches.push('Anthropic matches Zonos');
    if (hsCodeMatch.openaiVsZonos) matches.push('OpenAI matches Zonos');
    if (hsCodeMatch.anthropicVsOpenai) matches.push('Anthropic matches OpenAI');
    if (matches.length > 0) {
      notes.push(matches.join('. ') + '.');
    } else {
      notes.push('All providers returned different HS codes.');
    }
  }

  // Duty difference
  if (dutyDifference) {
    const maxDiff = Math.max(
      dutyDifference.anthropicVsZonos || 0,
      dutyDifference.openaiVsZonos || 0
    );
    if (maxDiff > 50) {
      notes.push(`Significant duty difference detected: up to €${maxDiff.toFixed(2)}`);
    } else if (maxDiff > 0) {
      notes.push(`Minor duty difference: €${maxDiff.toFixed(2)}`);
    }
  }

  // Confidence comparison
  const anthropicConf = classifications.anthropic?.confidence || 0;
  const openaiConf = classifications.openai?.confidence || 0;
  if (Math.abs(anthropicConf - openaiConf) > 0.2) {
    const higher = anthropicConf > openaiConf ? 'Anthropic' : 'OpenAI';
    notes.push(`${higher} has notably higher confidence.`);
  }

  return notes.join(' ');
}

export function getComparisonResult(id: string): ComparisonResult | undefined {
  return comparisonResults.get(id);
}

export function getAllComparisonResults(): ComparisonResult[] {
  return Array.from(comparisonResults.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getComparisonStats(): {
  total: number;
  anthropicWins: number;
  openaiWins: number;
  ties: number;
  avgConfidence: { anthropic: number; openai: number; zonos: number };
  hs6MatchRate: { anthropic: number; openai: number };
} {
  const results = getAllComparisonResults();

  let anthropicWins = 0;
  let openaiWins = 0;
  let ties = 0;
  let anthropicConfSum = 0;
  let openaiConfSum = 0;
  let zonosConfSum = 0;
  let anthropicConfCount = 0;
  let openaiConfCount = 0;
  let zonosConfCount = 0;
  let anthropicHs6Matches = 0;
  let openaiHs6Matches = 0;
  let anthropicHs6Total = 0;
  let openaiHs6Total = 0;

  for (const result of results) {
    if (result.analysis.winner === 'anthropic') anthropicWins++;
    else if (result.analysis.winner === 'openai') openaiWins++;
    else if (result.analysis.winner === 'tie') ties++;

    if (result.classifications.anthropic?.confidence) {
      anthropicConfSum += result.classifications.anthropic.confidence;
      anthropicConfCount++;
    }
    if (result.classifications.openai?.confidence) {
      openaiConfSum += result.classifications.openai.confidence;
      openaiConfCount++;
    }
    if (result.classifications.zonos?.confidence) {
      zonosConfSum += result.classifications.zonos.confidence;
      zonosConfCount++;
    }

    if (result.classifications.anthropic && result.classifications.zonos) {
      anthropicHs6Total++;
      if (result.analysis.hsCodeMatch.hs6Match.anthropicVsZonos) {
        anthropicHs6Matches++;
      }
    }
    if (result.classifications.openai && result.classifications.zonos) {
      openaiHs6Total++;
      if (result.analysis.hsCodeMatch.hs6Match.openaiVsZonos) {
        openaiHs6Matches++;
      }
    }
  }

  return {
    total: results.length,
    anthropicWins,
    openaiWins,
    ties,
    avgConfidence: {
      anthropic: anthropicConfCount > 0 ? anthropicConfSum / anthropicConfCount : 0,
      openai: openaiConfCount > 0 ? openaiConfSum / openaiConfCount : 0,
      zonos: zonosConfCount > 0 ? zonosConfSum / zonosConfCount : 0,
    },
    hs6MatchRate: {
      anthropic: anthropicHs6Total > 0 ? anthropicHs6Matches / anthropicHs6Total : 0,
      openai: openaiHs6Total > 0 ? openaiHs6Matches / openaiHs6Total : 0,
    },
  };
}
