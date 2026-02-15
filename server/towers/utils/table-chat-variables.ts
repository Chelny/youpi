import { Prisma } from "db/client";
import { TableChatMessageVariables } from "@/server/towers/modules/table-chat-message/table-chat-message.entity";

// Convert Prisma.JsonValue (from DB) → TableChatMessageVariables
export function jsonToTableChatVariables(json: Prisma.JsonValue | null | undefined): TableChatMessageVariables | null {
  if (!json) return null;
  if (typeof json !== "object" || Array.isArray(json)) return null;
  return json as TableChatMessageVariables;
}

// Convert TableChatMessageVariables → Prisma.JsonValue (for DB)
export function tableChatVariablesToJson(
  obj: TableChatMessageVariables | null | undefined,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonObject | undefined {
  if (typeof obj === "undefined") return undefined;
  if (obj === null) return Prisma.DbNull;
  return obj as Prisma.JsonObject;
}
