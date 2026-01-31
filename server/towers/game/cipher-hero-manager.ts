export interface CipherKey {
  plainChar: string // Original character to be encrypted
  cipherChar: string // Cipher character that replaces the original
}

export class CipherHeroManager {
  private static readonly CIPHER_MAP: Record<string, string> = {
    A: "P",
    B: "6",
    C: "N",
    D: "X",
    E: "F",
    F: "E",
    G: "Z",
    H: "B",
    I: "G",
    J: "1",
    K: "L",
    L: "8",
    M: "U",
    N: "K",
    O: "R",
    P: "I",
    Q: "3",
    R: "W",
    S: "V",
    T: "9",
    U: "0",
    V: "M",
    W: "C",
    X: "4",
    Y: "5",
    Z: "7",
    "1": "O",
    "2": "T",
    "3": "D",
    "4": "Q",
    "5": "2",
    "6": "J",
    "7": "A",
    "8": "S",
    "9": "Y",
    "0": "H",
  };
  private static userCipherKeys: Map<string, CipherKey[]> = new Map<string, CipherKey[]>();
  private static heroCodes: Map<string, string> = new Map<string, string>();

  /**
   * Awards a random cipher key to the specified user.
   *
   * @param userId - The unique ID of the user receiving the key.
   * @returns The generated cipher key.
   */
  public static getCipherKey(userId: string): CipherKey | null {
    const allKeys: [string, string][] = Object.entries(CipherHeroManager.CIPHER_MAP);
    const existingKeys: Set<string> = new Set(
      CipherHeroManager.getUserCipherKeys(userId).map((k: CipherKey) => k.plainChar),
    );
    const availableKeys: [string, string][] = allKeys.filter(
      ([plainChar]: [string, string]) => !existingKeys.has(plainChar),
    );

    if (availableKeys.length === 0) return null;

    const [plainChar, cipherChar]: [string, string] = availableKeys[Math.floor(Math.random() * availableKeys.length)];

    const key: CipherKey = { plainChar, cipherChar };

    const keys: CipherKey[] = CipherHeroManager.userCipherKeys.get(userId) ?? [];
    keys.push(key);
    CipherHeroManager.userCipherKeys.set(userId, keys);

    return key;
  }

  /**
   * Retrieves all cipher keys generated to a specific user.
   *
   * @param userId - The ID of the user.
   * @returns A list of `CipherKey` objects.
   */
  private static getUserCipherKeys(userId: string): CipherKey[] {
    return CipherHeroManager.userCipherKeys.get(userId) ?? [];
  }

  /**
   * Generates a readable random code phrase using natural English sentence structure.
   *
   * @example
   * Brave dragon fights boldly
   * Mighty wolf leaps courageously
   *
   * @param userId - The ID of the user.
   * @returns The generated phrase in sentence case.
   */
  public static generateHeroCode(userId: string): string {
    const adjectives = ["brave", "fierce", "mighty", "quick", "silent", "valiant"];
    const nouns = ["hero", "dragon", "ninja", "wizard", "wolf", "knight"];
    const verbs = ["climbs", "fights", "wins", "leaps", "moves", "blocks"];
    const adverbs = ["boldly", "swiftly", "courageously", "silently", "skillfully", "valiantly"];

    const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const adjective: string = rand(adjectives);
    const noun: string = rand(nouns);
    const verb: string = rand(verbs);
    const adverb: string = rand(adverbs);

    const plainHeroCode: string = `${adjective} ${noun} ${verb} ${adverb}`;

    const encryptedHeroCode: string = plainHeroCode
      .toUpperCase()
      .split("")
      .map((char: string) => {
        if (char === " ") return " ";
        return CipherHeroManager.CIPHER_MAP[char] ?? char;
      })
      .join("");

    CipherHeroManager.heroCodes.set(userId, encryptedHeroCode);

    return encryptedHeroCode;
  }

  /**
   * Decrypts a hero code string using the inverse of the predefined CIPHER_MAP.
   * This function reverses the encryption done by the hero code generator.
   *
   * @param code - The encrypted hero code (e.g., "3WR6 APBJ").
   * @returns The decrypted version of the code (e.g., "QROB 7AH6").
   */
  private static decryptHeroCode(code: string): string {
    const decryptMap: Record<string, string> = Object.fromEntries(
      Object.entries(CipherHeroManager.CIPHER_MAP).map(([plain, cipher]: [string, string]) => [cipher, plain]),
    );

    return code
      .toUpperCase()
      .split("")
      .map((char: string) => {
        if (char === " ") return " ";
        return decryptMap[char] ?? char;
      })
      .join("");
  }

  /**
   * Checks whether the given guessed code matches the decrypted hero code
   * stored for the specified user.
   *
   * @param userId - The user ID to look up the hero code.
   * @param code - The guessed hero code to verify.
   * @returns True if the guessed code matches the decrypted hero code; otherwise, false.
   */
  public static isGuessedCodeMatchesHeroCode(userId: string, code: string): boolean {
    const encryptedCode: string | undefined = CipherHeroManager.heroCodes.get(userId);
    if (!encryptedCode) return false;

    const expectedPlain: string = CipherHeroManager.decryptHeroCode(encryptedCode);
    return code.toUpperCase().includes(expectedPlain);
  }

  /**
   * Removes the hero code entry associated with the given user.
   *
   * @param userId - The user ID whose hero code should be deleted.
   */
  public static removeHeroCode(userId: string): void {
    CipherHeroManager.heroCodes.delete(userId);
  }
}
