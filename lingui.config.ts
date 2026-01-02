import { defineConfig } from "@lingui/cli";

export default defineConfig({
  locales: ["en", "fr", "pseudo-LOCALE"],
  pseudoLocale: "pseudo-LOCALE",
  sourceLocale: "en",
  fallbackLocales: {
    default: "en",
    "pseudo-LOCALE": "en",
  },
  catalogs: [
    {
      path: "<rootDir>/translations/locales/{locale}/messages",
      include: [
        "<rootDir>/app/",
        "<rootDir>/components/",
        "<rootDir>/constants/",
        "<rootDir>/lib/",
        "<rootDir>/translations/languages.ts",
        "<rootDir>/utils/",
      ],
      exclude: ["<rootDir>/prisma/**"],
    },
  ],
  format: "po",
  orderBy: "message",
});
