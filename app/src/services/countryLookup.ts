/**
 * Country name/alias to ISO 2-letter code lookup.
 * Used by the local voice command parser to resolve spoken country names.
 */

const COUNTRY_MAP: Record<string, string> = {
  // Common names
  'united states': 'US',
  'america': 'US',
  'usa': 'US',
  'us': 'US',
  'the us': 'US',
  'the states': 'US',
  'france': 'FR',
  'french': 'FR',
  'germany': 'DE',
  'deutschland': 'DE',
  'german': 'DE',
  'united kingdom': 'GB',
  'uk': 'GB',
  'britain': 'GB',
  'great britain': 'GB',
  'england': 'GB',
  'china': 'CN',
  'chinese': 'CN',
  'japan': 'JP',
  'japanese': 'JP',
  'italy': 'IT',
  'italian': 'IT',
  'spain': 'ES',
  'spanish': 'ES',
  'canada': 'CA',
  'canadian': 'CA',
  'mexico': 'MX',
  'mexican': 'MX',
  'brazil': 'BR',
  'brazilian': 'BR',
  'india': 'IN',
  'indian': 'IN',
  'australia': 'AU',
  'australian': 'AU',
  'south korea': 'KR',
  'korea': 'KR',
  'korean': 'KR',
  'netherlands': 'NL',
  'holland': 'NL',
  'dutch': 'NL',
  'portugal': 'PT',
  'portuguese': 'PT',
  'switzerland': 'CH',
  'swiss': 'CH',
  'belgium': 'BE',
  'belgian': 'BE',
  'turkey': 'TR',
  'turkish': 'TR',
  'vietnam': 'VN',
  'vietnamese': 'VN',
  'thailand': 'TH',
  'thai': 'TH',
  'indonesia': 'ID',
  'indonesian': 'ID',
  'taiwan': 'TW',
  'taiwanese': 'TW',
  'poland': 'PL',
  'polish': 'PL',
  'sweden': 'SE',
  'swedish': 'SE',
  'ireland': 'IE',
  'irish': 'IE',
  'austria': 'AT',
  'austrian': 'AT',
};

// Build a reverse map for code -> display name (picks the most natural name)
const CODE_TO_NAME: Record<string, string> = {
  US: 'United States',
  FR: 'France',
  DE: 'Germany',
  GB: 'United Kingdom',
  CN: 'China',
  JP: 'Japan',
  IT: 'Italy',
  ES: 'Spain',
  CA: 'Canada',
  MX: 'Mexico',
  BR: 'Brazil',
  IN: 'India',
  AU: 'Australia',
  KR: 'South Korea',
  NL: 'Netherlands',
  PT: 'Portugal',
  CH: 'Switzerland',
  BE: 'Belgium',
  TR: 'Turkey',
  VN: 'Vietnam',
  TH: 'Thailand',
  ID: 'Indonesia',
  TW: 'Taiwan',
  PL: 'Poland',
  SE: 'Sweden',
  IE: 'Ireland',
  AT: 'Austria',
};

/**
 * Look up a country code from a spoken name or alias.
 * Returns the ISO 2-letter code or null if not found.
 */
export function lookupCountryCode(spoken: string): string | null {
  const normalized = spoken.trim().toLowerCase();

  // Direct match in alias map
  if (COUNTRY_MAP[normalized]) {
    return COUNTRY_MAP[normalized];
  }

  // If it's already a 2-letter ISO code, validate and return uppercase
  if (normalized.length === 2) {
    const upper = normalized.toUpperCase();
    if (CODE_TO_NAME[upper] || Object.values(COUNTRY_MAP).includes(upper)) {
      return upper;
    }
  }

  return null;
}

/**
 * Get display name for a country code.
 */
export function getCountryName(code: string): string {
  return CODE_TO_NAME[code.toUpperCase()] || code.toUpperCase();
}
