export interface FrenchFemininePatterns {
  suffix: string
  masculine: (w: string) => string
}

export interface FrenchPluralPatterns {
  suffix: string
  singular: (w: string) => string
}

export const FRENCH_FEMININE_PATTERNS: FrenchFemininePatterns[] = [
  { suffix: "asse", masculine: (w: string) => w.slice(0, -4) + "ard" },
  { suffix: "enne", masculine: (w: string) => w.slice(0, -2) }, // "enne" -> "en"
  { suffix: "euse", masculine: (w: string) => w.slice(0, -4) + "eur" },
  { suffix: "trice", masculine: (w: string) => w.slice(0, -5) + "teur" },
  { suffix: "ère", masculine: (w: string) => w.slice(0, -3) + "er" },
  { suffix: "ve", masculine: (w: string) => w.slice(0, -2) + "f" },
  { suffix: "elle", masculine: (w: string) => w.slice(0, -2) }, // "elle" -> "el"
  { suffix: "onne", masculine: (w: string) => w.slice(0, -2) }, // "onne" -> "on"
  { suffix: "ette", masculine: (w: string) => w.slice(0, -2) }, // "ette" -> "et"
];

export const FRENCH_PLURAL_PATTERNS: FrenchPluralPatterns[] = [
  { suffix: "aux", singular: (w: string) => w.slice(0, -3) + "al" }, // -al -> -aux
  { suffix: "eaux", singular: (w: string) => w.slice(0, -1) }, // -eau -> -eaux
  { suffix: "s", singular: (w: string) => w.slice(0, -1) }, // Simple -s
  { suffix: "x", singular: (w: string) => w.slice(0, -1) }, // Some -x plurals
];
