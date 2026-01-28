import type { ClassificationInput, ClassificationResult, DutyCalculation } from '../../types/classification.js';

const ZONOS_API_BASE = 'https://api.zonos.com';

interface ZonosClassifyResponse {
  data?: {
    classificationConfidences?: Array<{
      hsCode: string;
      confidence: number;
      description?: string;
    }>;
  };
  errors?: Array<{ message: string }>;
}

interface ZonosLandedCostResponse {
  data?: {
    landedCostCalculateWorkflow?: {
      duties?: Array<{
        amount: number;
        rate: string;
        type: string;
      }>;
      taxes?: Array<{
        amount: number;
        rate: string;
        type: string;
      }>;
      totals?: {
        landedCostTotal: number;
        dutyTotal: number;
        taxTotal: number;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

export async function classifyWithZonos(
  input: ClassificationInput
): Promise<ClassificationResult> {
  const startTime = Date.now();

  const apiKey = process.env.ZONOS_API_KEY;
  if (!apiKey) {
    return {
      provider: 'zonos',
      hsCode: '',
      hsCode6: '',
      description: '',
      confidence: 0,
      latencyMs: Date.now() - startTime,
      error: 'ZONOS_API_KEY not configured',
    };
  }

  try {
    // Zonos Classify API uses GraphQL
    const query = `
      mutation classifyProduct($input: ClassificationInput!) {
        classification(input: $input) {
          classificationConfidences {
            hsCode
            confidence
            description
          }
        }
      }
    `;

    const variables = {
      input: {
        ...(input.imageUrl && { imageUrl: input.imageUrl }),
        ...(input.productName && { name: input.productName }),
        ...(input.productDescription && { description: input.productDescription }),
        shipToCountry: input.shipToCountry || 'FR',
      },
    };

    const response = await fetch(`${ZONOS_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'credentialToken': apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`Zonos API error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as ZonosClassifyResponse;

    if (result.errors?.length) {
      throw new Error(result.errors[0].message);
    }

    const topResult = result.data?.classificationConfidences?.[0];
    if (!topResult) {
      throw new Error('No classification results from Zonos');
    }

    const hsCode = topResult.hsCode.replace(/\./g, '');

    return {
      provider: 'zonos',
      hsCode,
      hsCode6: hsCode.slice(0, 6),
      hsCode8: hsCode.length >= 8 ? hsCode.slice(0, 8) : undefined,
      description: topResult.description || '',
      confidence: topResult.confidence,
      rawResponse: result,
      latencyMs,
    };
  } catch (error) {
    return {
      provider: 'zonos',
      hsCode: '',
      hsCode6: '',
      description: '',
      confidence: 0,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function calculateDutyWithZonos(
  hsCode: string,
  productValue: number,
  currency: string = 'EUR',
  originCountry: string = 'US',
  shipToCountry: string = 'FR'
): Promise<DutyCalculation> {
  const startTime = Date.now();

  const apiKey = process.env.ZONOS_API_KEY;
  if (!apiKey) {
    return {
      provider: 'zonos',
      hsCode,
      duties: { amount: 0, rate: '0%', type: 'unknown' },
      vat: { amount: 0, rate: '0%' },
      totalLandedCost: productValue,
      breakdown: [],
      currency,
      latencyMs: Date.now() - startTime,
      error: 'ZONOS_API_KEY not configured',
    };
  }

  try {
    // Zonos Landed Cost API
    const query = `
      mutation calculateLandedCost($input: LandedCostInput!) {
        landedCostCalculateWorkflow(input: $input) {
          duties {
            amount
            rate
            type
          }
          taxes {
            amount
            rate
            type
          }
          totals {
            landedCostTotal
            dutyTotal
            taxTotal
          }
        }
      }
    `;

    const variables = {
      input: {
        items: [
          {
            hsCode,
            amount: productValue,
            currencyCode: currency,
            countryOfOrigin: originCountry,
          },
        ],
        shipToCountry,
        shipFromCountry: originCountry,
      },
    };

    const response = await fetch(`${ZONOS_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'credentialToken': apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`Zonos API error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as ZonosLandedCostResponse;

    if (result.errors?.length) {
      throw new Error(result.errors[0].message);
    }

    const landedCost = result.data?.landedCostCalculateWorkflow;
    if (!landedCost) {
      throw new Error('No landed cost results from Zonos');
    }

    const duties = landedCost.duties?.[0] || { amount: 0, rate: '0%', type: 'duty' };
    const vat = landedCost.taxes?.find((t) => t.type.toLowerCase().includes('vat')) || {
      amount: 0,
      rate: '0%',
      type: 'VAT',
    };

    const breakdown = [
      { type: 'Product', amount: productValue },
      ...(landedCost.duties || []).map((d) => ({
        type: d.type,
        amount: d.amount,
        rate: d.rate,
      })),
      ...(landedCost.taxes || []).map((t) => ({
        type: t.type,
        amount: t.amount,
        rate: t.rate,
      })),
    ];

    return {
      provider: 'zonos',
      hsCode,
      duties: {
        amount: landedCost.totals?.dutyTotal || duties.amount,
        rate: duties.rate,
        type: duties.type,
      },
      vat: {
        amount: landedCost.totals?.taxTotal || vat.amount,
        rate: vat.rate,
      },
      totalLandedCost: landedCost.totals?.landedCostTotal || productValue,
      breakdown,
      currency,
      latencyMs,
    };
  } catch (error) {
    return {
      provider: 'zonos',
      hsCode,
      duties: { amount: 0, rate: '0%', type: 'unknown' },
      vat: { amount: 0, rate: '0%' },
      totalLandedCost: productValue,
      breakdown: [],
      currency,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
