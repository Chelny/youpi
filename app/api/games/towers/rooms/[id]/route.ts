import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, handleUnauthorizedApiError } from "@/lib/api-error";
import { auth, Session } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Room, RoomPlainObject } from "@/server/towers/modules/room/room.entity";
import { RoomFactory } from "@/server/towers/modules/room/room.factory";
import { RoomManager } from "@/server/towers/modules/room/room.manager";
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
    const dbRoom: TowersRoomWithRelations = await prisma.towersRoom.findUniqueOrThrow({
      where: { id },
      include: getTowersRoomIncludes(),
    });

    const room: Room = RoomFactory.createRoomWithRelations(dbRoom);
    const data: RoomPlainObject = await RoomManager.roomViewForPlayer(room, session.user.id);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
