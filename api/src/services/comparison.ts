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
  const shipToCountry = request.shipToCountry || 'US';

  const input: ClassificationInput = {
    imageBase64: request.imageBase64,
    imageUrl: request.imageUrl,
    productName: request.productName,
    productDescription: request.productDescription,
    originCountry: request.originCountry,
    shipToCountry,
  };

  // Step 1: Run Anthropic FIRST so we can use its output for Zonos
  const classifications: ComparisonResult['classifications'] = {};

  if (providers.includes('anthropic')) {
    console.log('[Compare] Running Anthropic classification...');
    classifications.anthropic = await classifyWithAnthropic(input);
    console.log('[Compare] Anthropic result:', {
      hsCode: classifications.anthropic.hsCode6,
      confidence: classifications.anthropic.confidence,
      estimatedValue: classifications.anthropic.estimatedValueEUR,
      productIdentified: (classifications.anthropic.rawResponse as Record<string, unknown>)?.productIdentified,
      error: classifications.anthropic.error,
    });
  }

  // Step 2: Run Zonos classification with Anthropic's product identification as fallback
  // Zonos can't handle base64 images — it needs a URL or product name/description
  if (providers.includes('zonos')) {
    const zonosInput = { ...input };

    // If we only have base64 (no URL, no product name), use Anthropic's identified product
    const hasImageUrl = !!input.imageUrl;
    const hasProductName = !!input.productName;
    const hasProductDescription = !!input.productDescription;

    if (!hasImageUrl && !hasProductName && !hasProductDescription) {
      const anthropicProduct = (classifications.anthropic?.rawResponse as Record<string, unknown> | undefined)?.productIdentified;
      const anthropicDesc = classifications.anthropic?.description;
      if (anthropicProduct) {
        zonosInput.productName = anthropicProduct as string;
        console.log('[Compare] Using Anthropic product ID for Zonos:', anthropicProduct);
      }
      if (anthropicDesc) {
        zonosInput.productDescription = anthropicDesc as string;
      }
    }

    console.log('[Compare] Running Zonos classification...');
    classifications.zonos = await classifyWithZonos(zonosInput);
    console.log('[Compare] Zonos result:', {
      hsCode: classifications.zonos.hsCode6,
      confidence: classifications.zonos.confidence,
      error: classifications.zonos.error,
    });
  }

  // Run OpenAI in parallel if requested (non-blocking)
  if (providers.includes('openai')) {
    classifications.openai = await classifyWithOpenAI(input);
  }

  // Step 3: Determine product value
  let productValue = request.productValue;
  let isEstimatedValue = false;

  if (!productValue && classifications.anthropic?.estimatedValueEUR) {
    productValue = classifications.anthropic.estimatedValueEUR;
    isEstimatedValue = true;
    console.log('[Compare] Using AI-estimated value:', productValue);
  }

  // Also handle case where estimatedValueEUR was returned as part of rawResponse but not parsed
  if (!productValue && classifications.anthropic?.rawResponse) {
    const raw = classifications.anthropic.rawResponse as Record<string, unknown>;
    const rawValue = raw.estimatedValueEUR;
    if (typeof rawValue === 'number' && rawValue > 0) {
      productValue = rawValue;
      isEstimatedValue = true;
      console.log('[Compare] Using value from rawResponse:', productValue);
    } else if (typeof rawValue === 'string') {
      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed) && parsed > 0) {
        productValue = parsed;
        isEstimatedValue = true;
        console.log('[Compare] Parsed string value from rawResponse:', productValue);
      }
    }
  }

  // Step 4: Calculate duties for every provider with a valid HS code
  let dutyCalculations: ComparisonResult['dutyCalculations'] | undefined;

  if (productValue && productValue > 0) {
    console.log('[Compare] Calculating duties with value:', productValue);
    dutyCalculations = {};

    const dutyPromises: Promise<DutyCalculation>[] = [];
    const dutyProviders: Array<'anthropic' | 'openai' | 'zonos'> = [];

    for (const provider of ['anthropic', 'openai', 'zonos'] as const) {
      const classification = classifications[provider];
      if (classification?.hsCode && !classification.error) {
        dutyProviders.push(provider);
        dutyPromises.push(
          calculateDutyWithZonos(
            classification.hsCode,
            productValue,
            request.currency || 'EUR',
            request.originCountry || 'US',
            shipToCountry
          ).then((duty) => ({ ...duty, provider }))
        );
      }
    }

    // If Zonos classification failed but Anthropic succeeded,
    // also calculate a "zonos" duty using Anthropic's HS code so user always sees duty
    if (!classifications.zonos?.hsCode || classifications.zonos?.error) {
      const anthropicHs = classifications.anthropic;
      if (anthropicHs?.hsCode && !anthropicHs.error && !dutyProviders.includes('zonos')) {
        console.log('[Compare] Zonos classification failed — using Anthropic HS code for Zonos duty calc');
        dutyProviders.push('zonos');
        dutyPromises.push(
          calculateDutyWithZonos(
            anthropicHs.hsCode,
            productValue,
            request.currency || 'EUR',
            request.originCountry || 'US',
            shipToCountry
          ).then((duty) => ({ ...duty, provider: 'zonos' as const }))
        );
      }
    }

    const dutyResults = await Promise.all(dutyPromises);
    for (let i = 0; i < dutyResults.length; i++) {
      dutyCalculations[dutyProviders[i]] = dutyResults[i];
      console.log(`[Compare] Duty for ${dutyProviders[i]}:`, {
        totalLandedCost: dutyResults[i].totalLandedCost,
        duties: dutyResults[i].duties.amount,
        vat: dutyResults[i].vat.amount,
        error: dutyResults[i].error,
      });
    }
  } else {
    console.log('[Compare] No product value available — skipping duty calculation');
  }

  // Analyze results
  const analysis = analyzeResults(classifications, dutyCalculations);

  const result: ComparisonResult = {
    id,
    timestamp,
    input,
    productValue,
    isEstimatedValue,
    shipToCountry,
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
