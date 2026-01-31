import { PorterStemmer, PorterStemmerFr } from "natural/lib/natural/stemmers";
import {
  FRENCH_FEMININE_PATTERNS,
  FRENCH_PLURAL_PATTERNS,
  FrenchFemininePatterns,
} from "@/server/profanity/utils/french-variations";
import {
  convertSymbolsInString,
  initLeetConverter,
  MULTI_CHAR_SYMBOLS,
  SYMBOL_TO_POSSIBLE_LETTERS,
} from "@/server/profanity/utils/leet-converter";
import { SupportedLocales } from "@/translations/languages";

initLeetConverter();

// Global store for profane words, used by normalizeWord to prefer profane interpretations.
let profaneWordsForNormalization: Set<string> | null = null;

/**
 * Sanitizes text by removing accents and converting to lowercase.
 * Used to normalize text for comparison with the profanity dictionary.
 *
 * @param text - Text to sanitize
 * @returns Sanitized text with accents removed and converted to lowercase
 */
export function sanitizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getAllPossibleInterpretations(word: string): string[] {
  return convertSymbolsInString(word);
}

/**
 * Sets the profane words dictionary for use in normalizeWord.
 * This allows normalizeWord to return profane interpretations when ambiguous symbols exist.
 *
 * @param words - Set of sanitized profane words
 */
export function setProfaneWordsForNormalization(words: Set<string>): void {
  profaneWordsForNormalization = words;
}

const normalizeWordCache = new Map<string, string>();

/**
 * Normalizes a word by converting leet symbols to letters and removing non-letter characters.
 * Prefers profane interpretations when available (requires setProfaneWordsForNormalization to be called).
 *
 * @param word - Word to normalize
 * @returns Normalized word in lowercase, with symbols converted and non-letters removed
 */
export function normalizeWord(word: string): string {
  const cacheKey: string = word.toLowerCase();

  if (normalizeWordCache.has(cacheKey)) {
    return normalizeWordCache.get(cacheKey)!;
  }

  const allInterpretations: string[] = getAllPossibleInterpretations(word);

  // Single-pass cleaning function
  const cleanInterpretation = (str: string): string => {
    // Convert ALL symbols in one pass
    let result: string = "";
    let i: number = 0;

    while (i < str.length) {
      let replaced: boolean = false;

      // Check multi-char symbols first
      for (const symbol of MULTI_CHAR_SYMBOLS) {
        if (str.substring(i, i + symbol.length) === symbol) {
          const letters: string[] | undefined = SYMBOL_TO_POSSIBLE_LETTERS.get(symbol);
          result += letters?.[0];
          i += symbol.length;
          replaced = true;
          break;
        }
      }

      if (!replaced) {
        const char: string = str[i];
        const letters: string[] | undefined = SYMBOL_TO_POSSIBLE_LETTERS.get(char);
        result += letters && letters.length > 0 ? letters[0] : char;
        i++;
      }
    }

    // Remove non-letters and sanitize
    const lettersOnly: string = result.replace(/[^\p{L}]/gu, "");
    return sanitizeText(lettersOnly);
  };

  const cleanedInterpretations: string[] = allInterpretations.map(cleanInterpretation);

  // Find profane interpretation
  if (profaneWordsForNormalization) {
    for (const interpretation of cleanedInterpretations) {
      // Direct match
      if (profaneWordsForNormalization.has(interpretation)) {
        normalizeWordCache.set(cacheKey, interpretation);
        return interpretation;
      }

      // Check variations
      if (checkWordVariations(interpretation, profaneWordsForNormalization)) {
        normalizeWordCache.set(cacheKey, interpretation);
        return interpretation;
      }

      // Check stems
      const englishStem: string = getStem(interpretation, "en");
      const frenchStem: string = getStem(interpretation, "fr");

      if (profaneWordsForNormalization.has(englishStem) || profaneWordsForNormalization.has(frenchStem)) {
        normalizeWordCache.set(cacheKey, interpretation);
        return interpretation;
      }
    }
  }

  const result: string = cleanedInterpretations[0];
  normalizeWordCache.set(cacheKey, result);

  return result;
}

/**
 * Gets the stem or lemma of a word using language-specific Porter stemming algorithms.
 *
 * This function applies the Porter stemming algorithm to reduce a word to its base form
 * by removing common morphological and inflectional endings. Different algorithms are
 * used for English and French to handle language-specific morphology.
 *
 * @param word - The word to stem. The word will be converted to lowercase before processing.
 *               Can contain letters and common accents (for French).
 * @param language - The language of the word. Determines which stemming algorithm to apply.
 *                   Defaults to `"en"` (English).
 * @returns The stemmed version of the input word as a lowercase string.
 *
 * @remarks
 * ## Stemming vs Lemmatization
 * - **Stemming** (what this function does) aggressively chops off word endings to get a
 *   common base form, which may not be a real word (e.g., "running" → "run", "flies" → "fli").
 * - **Lemmatization** returns the dictionary form (lemma) of a word (e.g., "better" → "good").
 */
function getStem(word: string, language: SupportedLocales = "en"): string {
  const normalized: string = word.toLowerCase();

  switch (language) {
    case "fr":
      return PorterStemmerFr.stem(normalized);
    default:
      return PorterStemmer.stem(normalized);
  }
}

/**
 * Checks if a normalized word matches profane words through common variations
 * (plurals, French feminine forms, etc.).
 * This is the SINGLE place for variation checking logic.
 *
 * @param normalizedWord - Already normalized word to check
 * @param profaneWords - Set of sanitized profane words
 * @param options - Optional parameters to control checking
 * @returns True if any variation of the word is profane
 */
function checkWordVariations(
  normalizedWord: string,
  profaneWords: Set<string>,
  options: { skipIfStemmed?: boolean; englishStem?: string; frenchStem?: string } = {},
): boolean {
  const { skipIfStemmed = false, englishStem, frenchStem } = options;

  // === ENGLISH PLURALS ===
  const skipEnglish: string | boolean | undefined = skipIfStemmed && englishStem && profaneWords.has(englishStem);

  if (!skipEnglish) {
    if (normalizedWord.endsWith("s")) {
      const withoutS: string = normalizedWord.slice(0, -1);
      if (profaneWords.has(withoutS)) {
        return true;
      }

      // Try removing 'es'
      if (normalizedWord.endsWith("es")) {
        const withoutEs: string = normalizedWord.slice(0, -2);
        if (profaneWords.has(withoutEs)) {
          return true;
        }
      }
    }
  }

  // === FRENCH FEMININE FORMS ===
  const skipFrench: string | boolean | undefined = skipIfStemmed && frenchStem && profaneWords.has(frenchStem);

  // French feminine forms
  if (!skipFrench) {
    // Check patterns
    for (const pattern of FRENCH_FEMININE_PATTERNS) {
      if (normalizedWord.endsWith(pattern.suffix)) {
        if (profaneWords.has(pattern.masculine(normalizedWord))) {
          return true;
        }
      }
    }

    for (const pattern of FRENCH_PLURAL_PATTERNS) {
      if (normalizedWord.endsWith(pattern.suffix)) {
        if (profaneWords.has(pattern.singular(normalizedWord))) {
          return true;
        }
      }
    }

    const isSimpleFeminineE = (word: string): boolean =>
      word.endsWith("e") &&
      !FRENCH_FEMININE_PATTERNS.some((pattern: FrenchFemininePatterns) => word.endsWith(pattern.suffix));

    // Simple 'e' ending
    if (isSimpleFeminineE(normalizedWord)) {
      const withoutE: string = normalizedWord.slice(0, -1);
      if (profaneWords.has(withoutE)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if a word or its variations are profane by comparing against a profanity dictionary.
 * This is a helper function that encapsulates the core profanity checking logic.
 *
 * @param word - The word to check for profanity. Can contain letters and common symbols.
 * @param profaneWords - A Set of sanitized profane words to check against.
 *                       Words should already be normalized (lowercase, no accents).
 *
 * @returns `true` if the word or any of its linguistic variations (stems, plurals,
 *          feminine forms, etc.) is found in the profane words set, `false` otherwise.
 *
 * @remarks
 * This function performs multiple checks in order:
 * 1. **Direct match**: Checks if the normalized word exists in the profane words set
 * 2. **Stem matching**: Compares English and French stems of the word against stems
 *    of profane words in the dictionary
 * 3. **Word variations**: Checks for common linguistic variations like plurals,
 *    feminine forms, and verb conjugations
 *
 * The function handles:
 * - Normalization of leet speak (e.g., "f.u.c.k" → "fuck")
 * - Diacritic removal (e.g., "câlisse" → "calisse")
 * - Case insensitivity
 * - English and French stemming via PorterStemmer algorithms
 * - Common morphological variations in both languages
 *
 * @example
 * ```typescript
 * const profaneWords = new Set(["fuck", "shit", "connard"]);
 *
 * // Direct matches
 * checkWordAgainstProfaneList("fuck", profaneWords); // true
 * checkWordAgainstProfaneList("F.U.C.K", profaneWords); // true
 *
 * // Stem matches
 * checkWordAgainstProfaneList("fucking", profaneWords); // true
 *
 * // French variations
 * checkWordAgainstProfaneList("connasse", profaneWords); // true (from "connard")
 *
 * // Non-profane words
 * checkWordAgainstProfaneList("hello", profaneWords); // false
 * checkWordAgainstProfaneList("classification", profaneWords); // false
 * ```
 */
function checkWordAgainstProfaneList(word: string, profaneWords: Set<string>): boolean {
  const normalized: string = normalizeWord(word);

  if (profaneWords.has(normalized)) {
    return true;
  }

  const englishStem: string = getStem(normalized, "en");
  const frenchStem: string = getStem(normalized, "fr");

  for (const profaneWord of profaneWords) {
    const profaneEnglishStem: string = getStem(profaneWord, "en");
    const profaneFrenchStem: string = getStem(profaneWord, "fr");

    if (englishStem === profaneEnglishStem || frenchStem === profaneFrenchStem) {
      return true;
    }
  }

  if (checkWordVariations(normalized, profaneWords, { skipIfStemmed: true, englishStem, frenchStem })) {
    return true;
  }

  return false;
}

function getWordBeforeApostrophe(word: string): string | null {
  // Find words up to apostrophe using same logic as findWords
  const match: RegExpMatchArray | null = word.match(/^([\p{L}\d\$]+(?:[^\p{L}\s]*[\p{L}\d\$]+)*)['’]/u);
  return match ? match[1] : null;
}

/**
 * Checks if a word is profane by testing multiple interpretations and variations.
 * Handles leet symbols, apostrophes, plurals, and French feminine forms.
 *
 * @param word - Word to check for profanity
 * @param profaneWords - Set of sanitized profane words to check against
 * @returns True if the word or any of its interpretations/variations is profane
 */
export function isWordProfane(word: string, profaneWords: Set<string>): boolean {
  // First check the word directly
  if (checkWordAgainstProfaneList(word, profaneWords)) {
    return true;
  }

  // === APOSTROPHE HANDLING ===
  const beforeApostrophe: string | null = getWordBeforeApostrophe(word);
  if (beforeApostrophe) {
    if (checkWordAgainstProfaneList(beforeApostrophe, profaneWords)) {
      return true;
    }
  }

  // Check if the word contains ambiguous symbols
  let hasAmbiguousSymbols: boolean = false;
  for (const char of word) {
    const possibleLetters: string[] | undefined = SYMBOL_TO_POSSIBLE_LETTERS.get(char);
    if (possibleLetters && possibleLetters.length > 1) {
      hasAmbiguousSymbols = true;
      break;
    }
  }

  if (!hasAmbiguousSymbols) {
    // No ambiguous symbols, we already checked all possibilities
    return false;
  }

  // Generate and check interpretations
  const interpretations: string[] = [word.toLowerCase()];

  for (let i = 0; i < word.length; i++) {
    const char: string = word[i].toLowerCase();
    const possibleLetters: string[] | undefined = SYMBOL_TO_POSSIBLE_LETTERS.get(char);

    if (possibleLetters && possibleLetters.length > 1) {
      const newInterpretations: string[] = [];

      for (const interpretation of interpretations) {
        for (const letter of possibleLetters) {
          const newInterpretation: string = interpretation.substring(0, i) + letter + interpretation.substring(i + 1);
          newInterpretations.push(newInterpretation);
        }
      }

      interpretations.length = 0;
      interpretations.push(...newInterpretations);
    }
  }

  // Check each interpretation
  for (const interpretation of interpretations) {
    // Remove non-letter symbols from interpretation
    const lettersOnly: string = interpretation.replace(/[^\p{L}]/gu, "");
    if (checkWordAgainstProfaneList(lettersOnly, profaneWords)) {
      return true;
    }
  }

  return false;
}
