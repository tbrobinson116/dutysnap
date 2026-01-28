// Glasses connection types
export type GlassesConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

export interface GlassesDevice {
  id: string;
  name: string;
  model: 'ray-ban-meta-gen1' | 'ray-ban-meta-gen2' | 'oakley-meta-hstn' | 'mock';
  batteryLevel?: number;
  firmwareVersion?: string;
}

export interface GlassesState {
  connectionState: GlassesConnectionState;
  device: GlassesDevice | null;
  error: string | null;
  isCapturing: boolean;
}

// Classification types
export interface ClassificationResult {
  provider: 'anthropic' | 'zonos';
  hsCode: string;
  hsCode6: string;
  hsCode8?: string;
  description: string;
  confidence: number;
  reasoning?: string;
  latencyMs: number;
  error?: string;
}

export interface DutyCalculation {
  provider: 'anthropic' | 'zonos';
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
}

export interface ComparisonResult {
  id: string;
  timestamp: string;
  imageUri?: string;
  productName?: string;
  productDescription?: string;
  productValue?: number;
  originCountry?: string;
  classifications: {
    anthropic?: ClassificationResult;
    zonos?: ClassificationResult;
  };
  dutyCalculations?: {
    anthropic?: DutyCalculation;
    zonos?: DutyCalculation;
  };
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Scan: undefined;
  Results: { comparisonId: string };
  History: undefined;
  Settings: undefined;
};

// Scan state
export interface ScanState {
  capturedImage: string | null;
  isProcessing: boolean;
  result: ComparisonResult | null;
  error: string | null;
}
