import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, handleUnauthorizedApiError } from "@/lib/api-error";
import { auth, Session } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { RoomFactory } from "@/server/towers/modules/room/room.factory";
import { getTowersRoomIncludes, TowersRoomWithRelations } from "@/types/prisma";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse>> {
  const { id } = await params;

  // @ts-ignore
  const session: Session | null = await auth.api.getSession({ headers: await headers() });
  if (!session) return handleUnauthorizedApiError();

  try {
    const room: TowersRoomWithRelations = await prisma.towersRoom.findUniqueOrThrow({
      where: { id },
      include: getTowersRoomIncludes(),
    });

    return NextResponse.json(
      {
        success: true,
        data: RoomFactory.convertToPlainObject(room, session.user.id),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
