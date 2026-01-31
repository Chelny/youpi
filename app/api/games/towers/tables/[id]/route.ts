import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, handleUnauthorizedApiError } from "@/lib/api-error";
import { auth, Session } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { TablePlainObject } from "@/server/towers/modules/table/table.entity";
import { TableFactory } from "@/server/towers/modules/table/table.factory";
import { getTowersTableIncludes, TowersTableWithRelations } from "@/types/prisma";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse>> {
  const { id } = await params;

  // @ts-ignore
  const session: Session | null = await auth.api.getSession({ headers: await headers() });
  if (!session) return handleUnauthorizedApiError();

  try {
    const table: TowersTableWithRelations = await prisma.towersTable.findUniqueOrThrow({
      where: { id },
      include: getTowersTableIncludes(),
    });

    const data: TablePlainObject = await TableFactory.convertToPlainObject(table, session.user.id);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
