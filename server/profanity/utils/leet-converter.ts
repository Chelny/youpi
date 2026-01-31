export const LEET_SYMBOLS_MAP: Record<string, string[]> = {
  a: ["4", "@", "∆", "∂", "∀", "α", "λ", "ª", "æ"],
  b: ["6", "8", "ß"],
  c: ["©", "¢"],
  e: ["3", "€", "£", "∑", "æ"],
  f: ["ph", "ƒ"],
  g: ["6", "9"],
  i: ["1", "!", "¡", "|"],
  l: ["1", "|"],
  n: ["π"],
  o: ["0", "ø"],
  p: ["¶"],
  r: ["®", "Я"],
  s: ["z", "5", "$", "∫", "ß"],
  t: ["7", "†", "+"],
  v: ["√"],
  w: ["vv"],
  y: ["¥", "µ"],
};

export const SYMBOL_TO_POSSIBLE_LETTERS: Map<string, string[]> = new Map<string, string[]>();
export const MULTI_CHAR_SYMBOLS: string[] = [];

export function initLeetConverter(): void {
  for (const [letter, symbols] of Object.entries(LEET_SYMBOLS_MAP)) {
    for (const symbol of symbols) {
      addSymbolToMap(symbol.toLowerCase(), letter);
    }
  }

  // Build multi-char symbols list
  MULTI_CHAR_SYMBOLS.push(
    ...Array.from(SYMBOL_TO_POSSIBLE_LETTERS.keys())
      .filter((symbol: string) => symbol.length > 1)
      .sort((a: string, b: string) => b.length - a.length),
  );
}

function addSymbolToMap(symbol: string, letter: string): void {
  if (!SYMBOL_TO_POSSIBLE_LETTERS.has(symbol)) {
    SYMBOL_TO_POSSIBLE_LETTERS.set(symbol, []);
  }

  const letters: string[] | undefined = SYMBOL_TO_POSSIBLE_LETTERS.get(symbol);
  if (letters && !letters.includes(letter)) {
    letters.push(letter);
  }
}

/**
 * Generates all possible letter interpretations of a word containing ambiguous symbols.
 * For example, "n166a" generates ["nibba", "nigba", "nibga", "nigga"].
 *
 * @param str - The input word potentially containing leet symbols
 * @returns Array of all possible letter interpretations
 */
export function convertSymbolsInString(str: string): string[] {
  const results: Set<string> = new Set<string>([str.toLowerCase()]);

  const expand = (str: string, startIdx: number = 0): void => {
    for (let i = startIdx; i < str.length; i++) {
      const possibleLetters: string[] | undefined = SYMBOL_TO_POSSIBLE_LETTERS.get(str[i]);

      if (possibleLetters && possibleLetters.length > 0) {
        for (const letter of possibleLetters) {
          const newStr: string = str.substring(0, i) + letter + str.substring(i + 1);

          if (!results.has(newStr)) {
            results.add(newStr);
            expand(newStr, i + 1);
          }
        }
      }

      // Also check for multi-char symbols starting at this position
      for (const symbol of MULTI_CHAR_SYMBOLS) {
        if (str.substring(i, i + symbol.length) === symbol) {
          const symbolLetters: string[] | undefined = SYMBOL_TO_POSSIBLE_LETTERS.get(symbol);

          if (symbolLetters && symbolLetters.length > 0) {
            for (const letter of symbolLetters) {
              const newStr: string = str.substring(0, i) + letter + str.substring(i + symbol.length);

              if (!results.has(newStr)) {
                results.add(newStr);
                expand(newStr, i + 1);
              }
            }
          }
        }
      }
    }
  };

  expand(str.toLowerCase());
  return Array.from(results);
}
