import { Type } from "@sinclair/typebox";
import { WebsiteTheme } from "db/enums";

export const themeSchema = Type.Object({
  theme: Type.Union(Object.values(WebsiteTheme).map((theme: WebsiteTheme) => Type.Literal(theme))),
});

export type ThemePayload = FormPayload<typeof themeSchema>;
export type ThemeFormValidationErrors = FormValidationErrors<keyof ThemePayload>;
