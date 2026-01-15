/**
 * Shared abbreviation detection utilities.
 * Used by both readability.ts (sentence splitting) and pause-multipliers.ts (pause detection).
 */

/**
 * Common abbreviations that end with a period but are NOT sentence ends.
 * Merged from readability.ts and pause-multipliers.ts for single source of truth.
 */
export const ABBREVIATIONS = new Set([
  // Titles
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'rev', 'hon', 'gov', 'pres', 'gen', 'col', 'lt', 'sgt',
  // Academic/Professional
  'ph', 'phd', 'md', 'dds', 'esq', 'llb', 'ma', 'ba', 'bs', 'mba', 'rn', 'cpa',
  // Common abbreviations
  'vs', 'etc', 'eg', 'ie', 'al', 'approx', 'dept', 'est', 'inc', 'corp', 'ltd', 'co',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'st', 'ave', 'blvd', 'rd', 'dr', 'ln', 'ct', 'apt', 'ste', 'fl', 'mt', 'ft',
  'no', 'vol', 'pp', 'pg', 'ch', 'sec', 'fig', 'ref', 'ed', 'rev',
  // Measurements
  'oz', 'lb', 'lbs', 'ft', 'in', 'cm', 'mm', 'km', 'mi', 'kg', 'mg', 'ml', 'hr', 'min',
  // Countries/Regions
  'u', 'uk', 'usa', 'eu',
]);

/**
 * Title abbreviations that should stay attached to the following name.
 * e.g., "Dr. Smith" should not split between "Dr." and "Smith"
 */
export const TITLE_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'rev', 'hon', 'gov', 'pres', 'gen', 'col', 'lt', 'sgt', 'st',
]);

/**
 * Check if a word ending with a period is an abbreviation (not a sentence end).
 * 
 * @param word - The word to check (may include trailing period)
 * @returns true if the word is an abbreviation
 */
export function isAbbreviation(word: string): boolean {
  // Remove trailing period(s) and convert to lowercase for lookup
  const cleaned = word.replace(/\.+$/, '').toLowerCase();
  
  // Check for known abbreviations
  if (ABBREVIATIONS.has(cleaned)) return true;
  
  // Single letter followed by period (initials like "J." or "A.")
  if (/^[a-zA-Z]$/.test(cleaned)) return true;
  
  // All-caps 1-2 letter abbreviations (likely initials or acronyms)
  if (/^[A-Z]{1,2}$/.test(word.replace(/\.$/, ''))) return true;
  
  // Multi-period abbreviations like "U.S." or "e.g." or "i.e."
  if (/^[a-zA-Z]\.([a-zA-Z]\.)+$/.test(word)) return true;
  
  return false;
}

/**
 * Check if an abbreviation is a title (should stay with following word).
 * 
 * @param word - The word to check (may include trailing period)
 * @returns true if the word is a title abbreviation
 */
export function isTitleAbbreviation(word: string): boolean {
  return TITLE_ABBREVIATIONS.has(word.toLowerCase().replace(/\.$/, ''));
}
