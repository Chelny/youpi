import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, handleUnauthorizedApiError } from "@/lib/api-error";
import { auth, Session } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Table, TablePlainObject } from "@/server/towers/modules/table/table.entity";
import { TableFactory } from "@/server/towers/modules/table/table.factory";
import { TableManager } from "@/server/towers/modules/table/table.manager";
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
    const dbTable: TowersTableWithRelations = await prisma.towersTable.findUniqueOrThrow({
      where: { id },
      include: getTowersTableIncludes(),
    });

    const table: Table = TableFactory.convertToPlainObject(dbTable);
    const data: TablePlainObject = await TableManager.tableViewForPlayer(table, session.user.id);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
