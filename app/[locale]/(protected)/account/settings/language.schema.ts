import { Type } from "@sinclair/typebox";
import { Language, languages } from "@/translations/languages";

export const languageSchema = Type.Object({
  language: Type.Union(languages.map((language: Language) => Type.Literal(language.locale))),
});

export type LanguagePayload = FormPayload<typeof languageSchema>;
export type LanguageFormValidationErrors = FormValidationErrors<keyof LanguagePayload>;
