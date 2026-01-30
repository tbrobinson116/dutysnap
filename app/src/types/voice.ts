export type VoiceMode =
  | 'idle'
  | 'wake_word_listening'
  | 'active_listening'
  | 'processing';

export type VoiceCommandType =
  | 'capture'
  | 'ship_from'
  | 'ship_to'
  | 'product_info'
  | 'navigation';

export interface ParsedVoiceCommand {
  type: VoiceCommandType;
  confidence: number;
  /** ISO 2-letter country code for ship_from/ship_to */
  countryCode?: string;
  /** Resolved country name for TTS feedback */
  countryName?: string;
  /** Product name extracted from speech */
  productName?: string;
  /** Product value extracted from speech */
  productValue?: number;
  /** Currency code (EUR, USD, etc.) */
  currency?: string;
  /** Navigation destination */
  destination?: 'back' | 'history' | 'home';
  /** Raw transcript that was parsed */
  rawTranscript?: string;
}

export interface VoiceFeedbackOptions {
  /** Text to speak via TTS */
  message: string;
  /** Speech rate (0.5 = slow, 1.0 = normal, 1.5 = fast) */
  rate?: number;
  /** Speech pitch (0.5 = low, 1.0 = normal, 2.0 = high) */
  pitch?: number;
}
