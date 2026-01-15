/**
 * Multi-language syllable counting with dictionary lookup
 * 
 * Supports:
 * - English (CMU Pronouncing Dictionary-based rules)
 * - Norwegian (Bokmål and Nynorsk rules)
 * - Fallback to heuristic counting for unknown words
 */

export type SupportedLanguage = 'en' | 'no' | 'auto';

// Language-specific vowel patterns for heuristic counting
const VOWEL_PATTERNS: Record<string, RegExp> = {
  en: /[aeiouy]+/gi,
  no: /[aeiouyæøå]+/gi,
};

// Norwegian specific diphthongs that count as one syllable
const NORWEGIAN_DIPHTHONGS = ['ei', 'øy', 'au', 'ai', 'oi', 'ui', 'øi', 'æi'];

// Exception dictionaries for each language
const SYLLABLE_EXCEPTIONS: Record<string, Record<string, number>> = {
  en: {
    // Silent letters / unusual patterns
    'queue': 1,
    'area': 3,
    'idea': 3,
    'real': 2,
    'being': 2,
    'seeing': 2,
    'doing': 2,
    'going': 2,
    'saying': 2,
    'rhythm': 2,
    'synth': 1,
    'myth': 1,
    'gym': 1,
    'lynx': 1,
    'hymn': 1,
    'crypt': 1,
    // -ism words
    'prism': 2,
    'chasm': 2,
    // -tion/-sion exceptions
    'ion': 2,
    'lion': 2,
    // Borrowed words
    'cafe': 2,
    'fiance': 3,
    'fiancee': 3,
    'naive': 2,
    'cliche': 2,
    // Words where silent e rule over-corrects
    'recipe': 3,
    'simile': 3,
    'adobe': 3,
    'coyote': 3,
    'karate': 3,
    // Short words
    'the': 1,
    'they': 1,
    'eye': 1,
    'aye': 1,
    'aisle': 1,
    'isle': 1,
    // Common words that need correction
    'every': 2,
    'different': 3,
    'interesting': 4,
    'comfortable': 4,
    'vegetable': 4,
    'chocolate': 3,
    'business': 2,
    'family': 3,
    'beautiful': 3,
    'favorite': 3,
    'evening': 2,
    'several': 3,
    'actually': 4,
    'usually': 4,
    'probably': 3,
    'definitely': 4,
    'especially': 5,
    'basically': 4,
    'temperature': 4,
    'literature': 4,
    'environment': 4,
    'experience': 4,
  },
  no: {
    // Common Norwegian words with irregular syllable counts
    'jeg': 1,
    'deg': 1,
    'seg': 1,
    'meg': 1,
    'nei': 1,
    'sei': 1,
    'hei': 1,
    'øye': 2,
    'øyne': 2,
    'øyene': 3,
    'seier': 2,
    'feier': 2,
    'leia': 2,
    'meia': 2,
    'veien': 2,
    'tiden': 2,
    'siden': 2,
    'livet': 2,
    'riket': 2,
    // Words with silent letters
    'hvordan': 2,
    'hvorfor': 2,
    'hvem': 1,
    'hva': 1,
    'hvor': 1,
    'hvit': 1,
    // Compound-like words
    'kanskje': 2,
    'altså': 2,
    'derfor': 2,
    'fordi': 2,
    'eller': 2,
    'etter': 2,
    'under': 2,
    'over': 2,
    'mellom': 2,
    'gjennom': 2,
    'omkring': 3,
    // Common words
    'være': 2,
    'kunne': 2,
    'ville': 2,
    'skulle': 2,
    'måtte': 2,
    'burde': 2,
    'andre': 2,
    'første': 2,
    'mange': 2,
    'noen': 2,
    'ingen': 2,
    'alle': 2,
    'hver': 1,
    'bare': 2,
    'også': 2,
    'både': 2,
    'enda': 2,
    'hele': 2,
    'selv': 1,
    // Words ending in -lig
    'egentlig': 3,
    'vanligvis': 4,
    'naturlig': 3,
    'tydelig': 3,
    'mulig': 2,
    'umulig': 3,
    // Words ending in -else
    'opplevelse': 4,
    'forståelse': 4,
    'betydelse': 4,
    'følelse': 3,
  },
};

// Extended dictionary loaded from external source (populated at runtime)
let extendedDictionary: Record<string, Record<string, number>> = {
  en: {},
  no: {},
};

/**
 * Load an extended syllable dictionary for a language
 */
export function loadSyllableDictionary(language: 'en' | 'no', dictionary: Record<string, number>): void {
  extendedDictionary[language] = { ...extendedDictionary[language], ...dictionary };
}

/**
 * Clear the extended dictionary for a language
 */
export function clearSyllableDictionary(language: 'en' | 'no'): void {
  extendedDictionary[language] = {};
}

/**
 * Get syllable count from dictionary (exceptions + extended)
 */
function lookupSyllables(word: string, language: 'en' | 'no'): number | undefined {
  const lowerWord = word.toLowerCase();
  
  // Check exceptions first
  const exceptions = SYLLABLE_EXCEPTIONS[language];
  if (exceptions && exceptions[lowerWord] !== undefined) {
    return exceptions[lowerWord];
  }
  
  // Check extended dictionary
  const extended = extendedDictionary[language];
  if (extended && extended[lowerWord] !== undefined) {
    return extended[lowerWord];
  }
  
  return undefined;
}

/**
 * Estimate syllables for English words using heuristic rules
 */
function estimateSyllablesEnglish(word: string): number {
  const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (cleanWord.length <= 2) return 1;

  const vowelGroups = cleanWord.match(VOWEL_PATTERNS.en);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Rule: Consonant + 'le' ending - the 'e' is NOT silent (table, apple, bottle)
  const hasConsonantLe = cleanWord.endsWith('le') && 
                          cleanWord.length > 2 && 
                          !/[aeiouy]/.test(cleanWord[cleanWord.length - 3]);

  // Rule: Silent 'e' at end of word (but NOT for consonant+le words)
  if (cleanWord.endsWith('e') && count > 1 && !hasConsonantLe) {
    count--;
  }

  // Rule: -ed ending is often silent
  if (cleanWord.endsWith('ed') && cleanWord.length > 3) {
    const beforeEd = cleanWord.slice(-3, -2);
    if (beforeEd !== 't' && beforeEd !== 'd') {
      count--;
    }
  }

  // Rule: -es ending is usually not a separate syllable
  if (cleanWord.endsWith('es') && cleanWord.length > 3) {
    const beforeEs = cleanWord.slice(0, -2);
    const isSibilant = beforeEs.endsWith('s') || beforeEs.endsWith('z') || 
                       beforeEs.endsWith('x') || beforeEs.endsWith('ch') || 
                       beforeEs.endsWith('sh') || beforeEs.endsWith('ce') ||
                       beforeEs.endsWith('ge');
    if (!isSibilant && count > 1) {
      count--;
    }
  }

  return Math.max(1, count);
}

/**
 * Estimate syllables for Norwegian words
 */
function estimateSyllablesNorwegian(word: string): number {
  const cleanWord = word.replace(/[^a-zA-ZæøåÆØÅ]/g, '').toLowerCase();
  if (cleanWord.length <= 2) return 1;

  // Count vowel groups (including Norwegian vowels)
  let text = cleanWord;
  
  // Replace diphthongs with a single vowel marker to count them as one syllable
  for (const diphthong of NORWEGIAN_DIPHTHONGS) {
    text = text.replace(new RegExp(diphthong, 'gi'), 'a');
  }
  
  const vowelGroups = text.match(VOWEL_PATTERNS.no);
  const count = vowelGroups ? vowelGroups.length : 1;

  // Note: Unlike English, Norwegian does not have silent 'e' at word endings.
  // Final 'e' is almost always pronounced in Norwegian, so we don't apply
  // the English silent-e rule here.

  return Math.max(1, count);
}

/**
 * Detect language from text sample.
 * Uses character frequency and common word patterns.
 * 
 * Limitations:
 * - Only supports English ('en') and Norwegian ('no')
 * - Short texts (< 50 words) may be misclassified
 * - Texts with many common words in both languages may default to English
 * - Does not detect other Scandinavian languages (Danish, Swedish)
 * - The threshold (norwegianScore > englishScore * 1.5) is empirically chosen
 *   and may need adjustment for specific content types
 * 
 * @returns 'en' for English (default), 'no' for Norwegian
 */
export function detectLanguage(text: string): 'en' | 'no' {
  const lowerText = text.toLowerCase();
  
  // Check for Norwegian-specific characters
  const norwegianChars = (lowerText.match(/[æøå]/g) || []).length;
  if (norwegianChars > 0) {
    // If we have Norwegian characters, it's likely Norwegian
    const charRatio = norwegianChars / text.length;
    if (charRatio > 0.001) {  // Even a small presence indicates Norwegian
      return 'no';
    }
  }
  
  // Check for common Norwegian words
  const norwegianWords = ['og', 'jeg', 'det', 'er', 'en', 'på', 'som', 'med', 'har', 'til', 
                          'av', 'for', 'ikke', 'den', 'var', 'om', 'så', 'han', 'hun', 'vi',
                          'fra', 'eller', 'etter', 'også', 'nå', 'når', 'kan', 'vil', 'skal',
                          'må', 'her', 'dit', 'bare', 'mange', 'noen', 'alle', 'andre'];
  
  const englishWords = ['the', 'and', 'is', 'it', 'to', 'of', 'in', 'that', 'for', 'was',
                        'on', 'are', 'with', 'as', 'be', 'at', 'this', 'have', 'from', 'or',
                        'by', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can',
                        'there', 'use', 'an', 'each', 'which', 'she', 'do', 'how', 'their', 'if'];
  
  const words = lowerText.split(/\s+/);
  let norwegianScore = 0;
  let englishScore = 0;
  
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-ZæøåÆØÅ]/g, '');
    if (norwegianWords.includes(cleanWord)) norwegianScore++;
    if (englishWords.includes(cleanWord)) englishScore++;
  }
  
  // Require a significant difference to detect Norwegian
  // Default to English if unclear (more common)
  if (norwegianScore > englishScore * 1.5 && norwegianScore > 3) {
    return 'no';
  }
  
  return 'en';
}

/**
 * Count syllables in a word with multi-language support
 * 
 * @param word - The word to count syllables for
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 * @param textContext - Optional text context for auto-detection
 */
export function countSyllables(
  word: string, 
  language: SupportedLanguage = 'auto',
  textContext?: string
): number {
  // Determine language
  let lang: 'en' | 'no' = 'en';
  if (language === 'auto') {
    // Use context if available, otherwise analyze the word itself
    const textToAnalyze = textContext || word;
    lang = detectLanguage(textToAnalyze);
  } else {
    lang = language;
  }
  
  const cleanWord = word.replace(/[^a-zA-ZæøåÆØÅ]/g, '').toLowerCase();
  if (cleanWord.length === 0) return 0;
  if (cleanWord.length <= 2) return 1;
  
  // Try dictionary lookup first
  const dictResult = lookupSyllables(cleanWord, lang);
  if (dictResult !== undefined) {
    return dictResult;
  }
  
  // Fall back to heuristic counting
  if (lang === 'no') {
    return estimateSyllablesNorwegian(word);
  } else {
    return estimateSyllablesEnglish(word);
  }
}

/**
 * Batch count syllables for multiple words
 * More efficient when processing large amounts of text
 */
export function countSyllablesBatch(
  words: string[],
  language: SupportedLanguage = 'auto',
  textContext?: string
): number[] {
  // Detect language once for the entire batch
  let lang: 'en' | 'no' = 'en';
  if (language === 'auto') {
    const textToAnalyze = textContext || words.slice(0, 100).join(' ');
    lang = detectLanguage(textToAnalyze);
  } else {
    lang = language;
  }
  
  return words.map(word => countSyllables(word, lang));
}

/**
 * Get total syllable count for a text
 */
export function countTotalSyllables(text: string, language: SupportedLanguage = 'auto'): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const lang = language === 'auto' ? detectLanguage(text) : language;
  
  return words.reduce((total, word) => total + countSyllables(word, lang), 0);
}
