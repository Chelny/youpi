import { Prisma } from "db/client";
import { InstantMessageVariables } from "@/server/youpi/modules/instant-message/instant-message.entity";

// Convert Prisma.JsonValue (from DB) → InstantMessageVariables
export function jsonToInstantMessageVariables(
  json: Prisma.JsonValue | null | undefined,
): InstantMessageVariables | null {
  if (!json) return null;
  if (typeof json !== "object" || Array.isArray(json)) return null;
  return json as InstantMessageVariables;
}

// Convert TableChatMessageVariables → Prisma.JsonValue (for DB)
export function instantMessageVariablesToJson(
  obj: InstantMessageVariables | null | undefined,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonObject | undefined {
  if (typeof obj === "undefined") return undefined;
  if (obj === null) return Prisma.DbNull;
  return obj as Prisma.JsonObject;
}
