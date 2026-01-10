import { Type } from "@sinclair/typebox";

export const addPasskeySchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
});

export type AddPasskeyPayload = FormPayload<typeof addPasskeySchema>;
export type AddPasskeyFormValidationErrors = FormValidationErrors<keyof AddPasskeyPayload>;
