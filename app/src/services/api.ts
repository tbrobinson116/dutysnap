/**
 * API Service for DutySnap Backend
 *
 * Handles communication with the classification API
 */

import type { ComparisonResult } from '../types';
import type { ParsedVoiceCommand } from '../types/voice';

// API configuration
// In dev mode, use local network IP so physical devices can reach the backend.
// Update the IP if your network changes. For production, use the real API URL.
const API_BASE_URL = __DEV__
  ? 'http://192.168.21.142:3001'
  : 'https://api.dutysnap.com';

interface ClassifyRequest {
  imageBase64?: string;
  imageUrl?: string;
  productName?: string;
  productDescription?: string;
  originCountry?: string;
  shipToCountry?: string;
  productValue?: number;
  currency?: string;
  calculateDuty?: boolean;
}

interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as ApiError;
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.fetch<{ status: string }>('/health');
      return result.status === 'ok';
    } catch {
      return false;
    }
  }

  // Run classification comparison
  async classify(request: ClassifyRequest): Promise<ComparisonResult> {
    return this.fetch<ComparisonResult>('/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        providers: ['anthropic', 'zonos'],
        shipToCountry: request.shipToCountry || 'US',
        currency: request.currency || 'EUR',
      }),
    });
  }

  // Classify with image URI (converts to base64)
  async classifyImage(
    imageUri: string,
    options: Omit<ClassifyRequest, 'imageBase64' | 'imageUrl'> = {}
  ): Promise<ComparisonResult> {
    // Always request duty calculation — the backend will use AI-estimated value if none provided
    // Check if it's a URL or local file
    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      return this.classify({
        ...options,
        imageUrl: imageUri,
        calculateDuty: true,
      });
    }

    // Convert local file to base64
    const base64 = await this.imageToBase64(imageUri);
    return this.classify({
      ...options,
      imageBase64: base64,
      calculateDuty: true,
    });
  }

  // Convert image file to base64
  private async imageToBase64(uri: string): Promise<string> {
    // In React Native, we'd use FileSystem from expo-file-system
    // For now, return a placeholder - this will be implemented with expo-file-system
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Get comparison result by ID
  async getComparison(id: string): Promise<ComparisonResult> {
    return this.fetch<ComparisonResult>(`/api/compare/${id}`);
  }

  // Get all comparison results
  async getComparisonHistory(): Promise<{
    results: ComparisonResult[];
    count: number;
  }> {
    return this.fetch<{ results: ComparisonResult[]; count: number }>(
      '/api/compare'
    );
  }

  // Get comparison statistics
  async getStats(): Promise<{
    total: number;
    hs6MatchRate: { anthropic: number };
    avgConfidence: { anthropic: number; zonos: number };
  }> {
    return this.fetch('/api/compare/stats/summary');
  }

  // Parse voice command via LLM fallback (Tier 2)
  async parseVoiceCommand(transcript: string): Promise<ParsedVoiceCommand | null> {
    try {
      const result = await this.fetch<ParsedVoiceCommand>('/api/parse-voice', {
        method: 'POST',
        body: JSON.stringify({ transcript }),
      });
      // Backend returns { type: null } when no command is recognized
      if (!result.type) return null;
      return result;
    } catch {
      return null;
    }
  }

  // Update base URL (useful for settings)
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Singleton instance
export const api = new ApiService();
