import type { ClassificationInput, ClassificationResult, DutyCalculation } from '../../types/classification.js';

const ZONOS_API_BASE = 'https://api.zonos.com';

interface ZonosClassifyResponse {
  data?: {
    classificationsCalculate?: Array<{
      hsCode?: {
        code: string;
        description?: { full?: string };
      };
      confidence?: number;
    }>;
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
    const query = `
      mutation ClassifyProduct($input: [ClassificationCalculateInput!]!) {
        classificationsCalculate(input: $input) {
          hsCode {
            code
            description { full }
          }
        }
      }
    `;

    const countryCode = input.shipToCountry || 'US';
    
    const variables = {
      input: [{
        ...(input.productName && { name: input.productName }),
        ...(input.productDescription && { description: input.productDescription }),
        ...(input.imageUrl && { imageUrl: input.imageUrl }),
        configuration: {
          shipToCountries: [countryCode],
        },
      }],
    };

    console.log('Zonos request:', JSON.stringify(variables, null, 2));

    const response = await fetch(`${ZONOS_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'credentialToken': apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    const latencyMs = Date.now() - startTime;
    const responseText = await response.text();
    
    console.log('Zonos response:', responseText);

    if (!response.ok) {
      throw new Error(`Zonos API error: ${response.status} ${response.statusText}`);
    }

    const result = JSON.parse(responseText) as ZonosClassifyResponse;

    if (result.errors?.length) {
      throw new Error(result.errors[0].message);
    }

    const topResult = result.data?.classificationsCalculate?.[0];
    if (!topResult?.hsCode) {
      throw new Error('No classification results from Zonos');
    }

    const hsCode = topResult.hsCode.code.replace(/\./g, '');

    return {
      provider: 'zonos',
      hsCode,
      hsCode6: hsCode.slice(0, 6),
      hsCode8: hsCode.length >= 8 ? hsCode.slice(0, 8) : undefined,
      description: topResult.hsCode.description?.full || '',
      confidence: topResult.confidence || 0.85,
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
  shipToCountry: string = 'US'
): Promise<DutyCalculation> {
  const startTime = Date.now();

  const apiKey = process.env.ZONOS_API_KEY;
  if (!apiKey) {
    return {
      provider: 'zonos',
      hsCode,
      duties: { amount: 0, rate: '0%', type: 'duty' },
      vat: { amount: 0, rate: '0%' },
      totalLandedCost: productValue,
      breakdown: [],
      currency,
      latencyMs: Date.now() - startTime,
      error: 'ZONOS_API_KEY not configured',
    };
  }

  try {
    const query = `
      mutation CalculateLandedCost(
        $parties: [PartyCreateWorkflowInput!]!
        $items: [ItemCreateWorkflowInput!]!
        $landedCostConfig: LandedCostWorkFlowInput!
      ) {
        partyCreateWorkflow(input: $parties) {
          type
          id
        }
        itemCreateWorkflow(input: $items) {
          id
          amount
        }
        cartonizeWorkflow {
          id
          type
        }
        shipmentRatingCalculateWorkflow {
          id
          amount
        }
        landedCostCalculateWorkflow(input: $landedCostConfig) {
          id
          duties {
            amount
            currency
            note
          }
          taxes {
            amount
            currency
            note
          }
          fees {
            amount
            currency
            note
          }
        }
      }
    `;

    // Map country codes to minimal address info for Zonos
    const originAddress = getCountryAddress(originCountry);
    const destAddress = getCountryAddress(shipToCountry);

    const variables = {
      parties: [
        {
          location: {
            countryCode: originCountry,
            administrativeAreaCode: originAddress.adminCode,
            line1: originAddress.line1,
            postalCode: originAddress.postalCode,
            locality: originAddress.locality,
          },
          type: 'ORIGIN',
        },
        {
          location: {
            countryCode: shipToCountry,
            administrativeAreaCode: destAddress.adminCode,
            line1: destAddress.line1,
            postalCode: destAddress.postalCode,
            locality: destAddress.locality,
          },
          person: {
            email: 'customer@example.com',
            firstName: 'Test',
            lastName: 'Customer',
            phone: '+33100000000',
          },
          type: 'DESTINATION',
        },
      ],
      items: [
        {
          amount: productValue,
          currencyCode: currency,
          quantity: 1,
          countryOfOrigin: originCountry,
          hsCode: hsCode,
          description: `Product classified as HS ${hsCode}`,
        },
      ],
      landedCostConfig: {
        calculationMethod: 'DDP_PREFERRED',
        endUse: 'NOT_FOR_RESALE',
        tariffRate: 'ZONOS_PREFERRED',
      },
    };

    console.log('Zonos Landed Cost request:', JSON.stringify(variables, null, 2));

    const response = await fetch(`${ZONOS_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'credentialToken': apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    const latencyMs = Date.now() - startTime;
    const responseText = await response.text();

    console.log('Zonos Landed Cost response:', responseText);

    if (!response.ok) {
      throw new Error(`Zonos API error: ${response.status} ${response.statusText}`);
    }

    const result = JSON.parse(responseText);

    // Zonos returns partial errors (e.g., DHL shipping failures) alongside valid data.
    const landedCostResults = result.data?.landedCostCalculateWorkflow;

    // Check for intra-EU / domestic shipment (no duties apply)
    const isDomestic = result.errors?.some(
      (e: { message: string }) => e.message?.includes('Domestic shipments are not allowed')
    );
    if (isDomestic || !landedCostResults || landedCostResults.length === 0) {
      if (isDomestic) {
        // Intra-EU trade: no customs duties
        return {
          provider: 'zonos',
          hsCode,
          duties: { amount: 0, rate: '0%', type: 'intra_eu' },
          vat: { amount: productValue * 0.2, rate: '20%' },
          totalLandedCost: productValue + (productValue * 0.2),
          breakdown: [
            { type: 'Product', amount: productValue },
            { type: 'VAT (Intra-EU)', amount: productValue * 0.2, rate: '20%' },
          ],
          currency,
          latencyMs: Date.now() - startTime,
        };
      }
      const errorMsg = result.errors?.length
        ? result.errors.map((e: { message: string }) => e.message).join('; ')
        : 'No landed cost result from Zonos';
      throw new Error(errorMsg);
    }

    // Use the first landed cost result (cheapest shipping option)
    const landedCost = landedCostResults[0];

    // Sum up duties, taxes, fees
    const dutiesTotal = landedCost.duties?.reduce(
      (sum: number, d: { amount: number }) => sum + (d.amount || 0), 0
    ) ?? 0;
    const taxesTotal = landedCost.taxes?.reduce(
      (sum: number, t: { amount: number }) => sum + (t.amount || 0), 0
    ) ?? 0;
    const feesTotal = landedCost.fees?.reduce(
      (sum: number, f: { amount: number }) => sum + (f.amount || 0), 0
    ) ?? 0;

    const totalLandedCost = productValue + dutiesTotal + taxesTotal + feesTotal;

    // Calculate rates as percentages of product value
    const dutyRate = productValue > 0 ? ((dutiesTotal / productValue) * 100).toFixed(1) : '0';
    const vatRate = productValue > 0 ? ((taxesTotal / productValue) * 100).toFixed(1) : '0';

    const breakdown: DutyCalculation['breakdown'] = [
      { type: 'Product', amount: productValue },
    ];
    if (dutiesTotal > 0) {
      breakdown.push({ type: 'Customs Duty', amount: dutiesTotal, rate: `${dutyRate}%` });
    }
    if (taxesTotal > 0) {
      breakdown.push({ type: 'VAT/Tax', amount: taxesTotal, rate: `${vatRate}%` });
    }
    if (feesTotal > 0) {
      breakdown.push({ type: 'Fees', amount: feesTotal });
    }

    return {
      provider: 'zonos',
      hsCode,
      duties: { amount: dutiesTotal, rate: `${dutyRate}%`, type: 'customs_duty' },
      vat: { amount: taxesTotal, rate: `${vatRate}%` },
      totalLandedCost,
      breakdown,
      currency,
      latencyMs,
    };
  } catch (error) {
    return {
      provider: 'zonos',
      hsCode,
      duties: { amount: 0, rate: '0%', type: 'duty' },
      vat: { amount: 0, rate: '0%' },
      totalLandedCost: productValue,
      breakdown: [],
      currency,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Minimal address data per country for Zonos API requirements
function getCountryAddress(countryCode: string): {
  adminCode: string;
  line1: string;
  postalCode: string;
  locality: string;
} {
  const addresses: Record<string, { adminCode: string; line1: string; postalCode: string; locality: string }> = {
    FR: { adminCode: 'IDF', line1: '1 Rue de Rivoli', postalCode: '75001', locality: 'Paris' },
    US: { adminCode: 'UT', line1: '345 N 2450 E', postalCode: '84790', locality: 'St George' },
    CN: { adminCode: 'GD', line1: '1 Zhongshan Road', postalCode: '510000', locality: 'Guangzhou' },
    DE: { adminCode: 'BE', line1: '1 Unter den Linden', postalCode: '10117', locality: 'Berlin' },
    IT: { adminCode: 'RM', line1: '1 Via del Corso', postalCode: '00186', locality: 'Roma' },
    GB: { adminCode: 'ENG', line1: '1 Oxford Street', postalCode: 'W1D 1AN', locality: 'London' },
    JP: { adminCode: '13', line1: '1 Chome Marunouchi', postalCode: '100-0005', locality: 'Tokyo' },
    CA: { adminCode: 'ON', line1: '1 Yonge Street', postalCode: 'M5E 1E5', locality: 'Toronto' },
    AU: { adminCode: 'NSW', line1: '1 George Street', postalCode: '2000', locality: 'Sydney' },
    KR: { adminCode: '11', line1: '1 Sejong-daero', postalCode: '04524', locality: 'Seoul' },
    MX: { adminCode: 'CMX', line1: '1 Paseo de la Reforma', postalCode: '06600', locality: 'Mexico City' },
    BR: { adminCode: 'SP', line1: '1 Avenida Paulista', postalCode: '01310-100', locality: 'Sao Paulo' },
    IN: { adminCode: 'MH', line1: '1 MG Road', postalCode: '400001', locality: 'Mumbai' },
    ES: { adminCode: 'MD', line1: '1 Gran Via', postalCode: '28013', locality: 'Madrid' },
    NL: { adminCode: 'NH', line1: '1 Dam', postalCode: '1012 JS', locality: 'Amsterdam' },
    SE: { adminCode: 'AB', line1: '1 Drottninggatan', postalCode: '111 51', locality: 'Stockholm' },
    CH: { adminCode: 'ZH', line1: '1 Bahnhofstrasse', postalCode: '8001', locality: 'Zurich' },
    AE: { adminCode: 'DU', line1: '1 Sheikh Zayed Road', postalCode: '00000', locality: 'Dubai' },
    SG: { adminCode: '01', line1: '1 Raffles Place', postalCode: '048616', locality: 'Singapore' },
  };

  return addresses[countryCode] || {
    adminCode: '',
    line1: '1 Main Street',
    postalCode: '00000',
    locality: 'City',
  };
}
