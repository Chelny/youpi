import { MessageDescriptor } from "@lingui/core";
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { enUS, frCA, Locale } from "date-fns/locale";

export interface Language {
  locale: string
  getLabel: () => MessageDescriptor
  flag: string
  territory?: string
  rtl: boolean
  dateFnsLocale?: Locale
}

export type SupportedLocales = "en" | "fr" | "pseudo-LOCALE";
export const DEFAULT_LOCALE = "en";

export const languages: Language[] = [
  {
    locale: "en",
    getLabel: () => msg`English`,
    territory: "US",
    flag: "🇺🇸",
    rtl: false,
    dateFnsLocale: enUS,
  },
  {
    locale: "fr",
    getLabel: () => msg`French`,
    territory: "CA",
    flag: "🇨🇦",
    rtl: false,
    dateFnsLocale: frCA,
  },
  ...(process.env.NODE_ENV !== "production"
    ? [
        // Pseudo locale for testing RTL direction
        {
          locale: "pseudo-LOCALE",
          getLabel: () => msg`Pseudo`,
          flag: "🔤",
          rtl: true,
        },
      ]
    : []),
];

export const dynamicActivate = async (locale: string): Promise<void> => {
  const { messages } = await import(`@/translations/locales/${locale}/messages`);
  i18n.load(locale, messages);
  i18n.activate(locale);
};

export const getDateFnsLocale = (locale: string): Locale => {
  const language: Language | undefined = languages.find((language: Language) => language.locale === locale);
  return language?.dateFnsLocale || enUS;
};
