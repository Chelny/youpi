import { Prisma } from "db/client";

// Convert JsonValue (from DB) → Date[] | null
export function jsonToDates(json: Prisma.JsonValue | null | undefined): Date[] | null {
  if (!Array.isArray(json)) return null;

  return json
    .map((v: Prisma.JsonValue) => {
      if (typeof v === "string" || typeof v === "number") return new Date(v);
      return null;
    })
    .filter((v: Date | null): v is Date => v !== null);
}

// Convert Date[] | null → string[] | null (for DB)
export function datesToJson(
  dates: Date[] | null | undefined,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (typeof dates === "undefined" || dates === null) return undefined;
  if (dates === null) return Prisma.DbNull;
  return dates.map((d: Date) => d.toISOString());
}
