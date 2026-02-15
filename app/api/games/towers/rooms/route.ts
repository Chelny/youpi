import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import { RoomPlainObject } from "@/server/towers/modules/room/room.entity";
import { RoomFactory } from "@/server/towers/modules/room/room.factory";
import { getTowersRoomIncludes, TowersRoomWithRelations } from "@/types/prisma";

export async function GET(): Promise<NextResponse<ApiResponse>> {
  try {
    const dbRooms: TowersRoomWithRelations[] = await prisma.towersRoom.findMany({
      include: getTowersRoomIncludes(),
      orderBy: { sortOrder: "asc" },
    });

    const data: RoomPlainObject[] = RoomFactory.convertManyToPlainObject(dbRooms);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
