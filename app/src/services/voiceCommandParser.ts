/**
 * Tier 1 local voice command parser.
 * Uses regex pattern matching for instant command recognition.
 * Returns null for unrecognized input (triggers Tier 2 backend fallback).
 */

import type { ParsedVoiceCommand } from '../types/voice';
import { lookupCountryCode, getCountryName } from './countryLookup';

// Command patterns
const CAPTURE_PATTERN = /\b(snap|capture|take\s+(?:a\s+)?picture|take\s+(?:a\s+)?photo)\b/i;
const SHIP_FROM_PATTERN = /\bship(?:ping|ped)?\s*(?:it\s+)?from\s+(.+)/i;
const SHIP_TO_PATTERN = /\bship(?:ping|ped)?\s*(?:it\s+)?to\s+(.+)/i;
const NAV_BACK_PATTERN = /\b(go\s+back|go\s+to\s+back)\b/i;
const NAV_HISTORY_PATTERN = /\b(show\s+history|go\s+to\s+history|open\s+history)\b/i;
const NAV_HOME_PATTERN = /\b(go\s+home|go\s+to\s+home|open\s+home)\b/i;
const PRODUCT_INFO_PATTERN = /(?:it(?:'s| is)\s+(?:a\s+)?)?(.+?)\s+worth\s+(\d+(?:\.\d+)?)\s*(euros?|dollars?|pounds?|usd|eur|gbp)?/i;

const CURRENCY_MAP: Record<string, string> = {
  'euro': 'EUR',
  'euros': 'EUR',
  'eur': 'EUR',
  'dollar': 'USD',
  'dollars': 'USD',
  'usd': 'USD',
  'pound': 'GBP',
  'pounds': 'GBP',
  'gbp': 'GBP',
};

/**
 * Parse a voice transcript into a structured command.
 * Returns null if no command pattern matches (caller should use Tier 2 backend).
 */
export function parseVoiceCommand(transcript: string): ParsedVoiceCommand | null {
  const text = transcript.trim();
  if (!text) return null;

  // Check capture commands
  if (CAPTURE_PATTERN.test(text)) {
    return {
      type: 'capture',
      confidence: 1.0,
      rawTranscript: text,
    };
  }

  // Check ship-from commands
  const shipFromMatch = text.match(SHIP_FROM_PATTERN);
  if (shipFromMatch) {
    const countryCode = lookupCountryCode(shipFromMatch[1]);
    if (countryCode) {
      return {
        type: 'ship_from',
        confidence: 1.0,
        countryCode,
        countryName: getCountryName(countryCode),
        rawTranscript: text,
      };
    }
  }

  // Check ship-to commands
  const shipToMatch = text.match(SHIP_TO_PATTERN);
  if (shipToMatch) {
    const countryCode = lookupCountryCode(shipToMatch[1]);
    if (countryCode) {
      return {
        type: 'ship_to',
        confidence: 1.0,
        countryCode,
        countryName: getCountryName(countryCode),
        rawTranscript: text,
      };
    }
  }

  // Check navigation commands
  if (NAV_BACK_PATTERN.test(text)) {
    return {
      type: 'navigation',
      confidence: 1.0,
      destination: 'back',
      rawTranscript: text,
    };
  }
  if (NAV_HISTORY_PATTERN.test(text)) {
    return {
      type: 'navigation',
      confidence: 1.0,
      destination: 'history',
      rawTranscript: text,
    };
  }
  if (NAV_HOME_PATTERN.test(text)) {
    return {
      type: 'navigation',
      confidence: 1.0,
      destination: 'home',
      rawTranscript: text,
    };
  }

  // Check product info (e.g., "it's a leather handbag worth 200 euros")
  const productMatch = text.match(PRODUCT_INFO_PATTERN);
  if (productMatch) {
    const currencyWord = productMatch[3]?.toLowerCase();
    return {
      type: 'product_info',
      confidence: 0.9,
      productName: productMatch[1].trim(),
      productValue: parseFloat(productMatch[2]),
      currency: currencyWord ? (CURRENCY_MAP[currencyWord] || 'EUR') : 'EUR',
      rawTranscript: text,
    };
  }

  // No local match — return null so caller can try Tier 2 backend
  return null;
}
