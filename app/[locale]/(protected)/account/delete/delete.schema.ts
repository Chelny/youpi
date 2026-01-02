import { Type } from "@sinclair/typebox";
import { EMAIL_PATTERN } from "@/constants/regex";

export const deleteAccountSchema = Type.Object({
  email: Type.RegExp(EMAIL_PATTERN),
});

export type DeleteAccountPayload = FormPayload<typeof deleteAccountSchema>;
export type DeleteAccountFormValidationErrors = FormValidationErrors<keyof DeleteAccountPayload>;
