import { NextRequest, NextResponse } from "next/server";
import { TowersPlayerStats } from "db/client";
import { handleApiError } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import { PlayerStatsFactory } from "@/server/towers/modules/player-stats/player-stats.factory";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
): Promise<NextResponse<ApiResponse>> {
  const { playerId } = await params;

  try {
    const playerStats: TowersPlayerStats = await prisma.towersPlayerStats.findUniqueOrThrow({
      where: { playerId },
    });

    return NextResponse.json(
      {
        success: true,
        data: PlayerStatsFactory.convertToPlainObject(playerStats),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
