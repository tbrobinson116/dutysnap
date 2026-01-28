export interface ClassificationInput {
  imageBase64?: string;
  imageUrl?: string;
  productName?: string;
  productDescription?: string;
  originCountry?: string;
  shipToCountry: string; // Default: FR for France
}

export interface ClassificationResult {
  provider: 'anthropic' | 'openai' | 'zonos';
  hsCode: string;
  hsCode6: string; // First 6 digits (universal)
  hsCode8?: string; // 8 digits (EU specific)
  description: string;
  confidence: number; // 0-1
  reasoning?: string;
  rawResponse?: unknown;
  latencyMs: number;
  error?: string;
}

export interface DutyCalculation {
  provider: 'anthropic' | 'openai' | 'zonos';
  hsCode: string;
  duties: {
    amount: number;
    rate: string;
    type: string;
  };
  vat: {
    amount: number;
    rate: string;
  };
  totalLandedCost: number;
  breakdown: Array<{
    type: string;
    amount: number;
    rate?: string;
  }>;
  currency: string;
  latencyMs: number;
  error?: string;
}

export interface ComparisonResult {
  id: string;
  timestamp: string;
  input: ClassificationInput;
  productValue?: number;
  currency?: string;

  classifications: {
    anthropic?: ClassificationResult;
    openai?: ClassificationResult;
    zonos?: ClassificationResult;
  };

  dutyCalculations?: {
    anthropic?: DutyCalculation;
    openai?: DutyCalculation;
    zonos?: DutyCalculation;
  };

  analysis: {
    hsCodeMatch: {
      anthropicVsZonos: boolean;
      openaiVsZonos: boolean;
      anthropicVsOpenai: boolean;
      hs6Match: {
        anthropicVsZonos: boolean;
        openaiVsZonos: boolean;
        anthropicVsOpenai: boolean;
      };
    };
    confidenceScores: {
      anthropic?: number;
      openai?: number;
      zonos?: number;
    };
    dutyDifference?: {
      anthropicVsZonos?: number;
      openaiVsZonos?: number;
      anthropicVsOpenai?: number;
    };
    winner?: 'anthropic' | 'openai' | 'tie';
    notes?: string;
  };
}

export interface ComparisonRequest {
  imageBase64?: string;
  imageUrl?: string;
  productName?: string;
  productDescription?: string;
  originCountry?: string;
  shipToCountry?: string;
  productValue?: number;
  currency?: string;
  providers?: Array<'anthropic' | 'openai' | 'zonos'>;
  calculateDuty?: boolean;
}
