import { ReactNode } from "react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { I18n } from "@lingui/core";
import { TowersRoom, TowersTable } from "db/browser";
import { initLingui } from "@/app/init-lingui";
import TowersPageContent from "@/components/game/TowersPageContent";
import RoomsListSkeleton from "@/components/skeleton/RoomsListSkeleton";
import { ROUTE_TOWERS } from "@/constants/routes";
import prisma from "@/lib/prisma";
import { getTowersPlayerLiteIncludes, TowersPlayerLite } from "@/types/prisma";

const RoomsList = dynamic(() => import("@/components/game/RoomsList"), {
  loading: () => <RoomsListSkeleton />,
});

type TowersProps = PageProps<"/[locale]/games/towers">;

export async function generateMetadata({ params, searchParams }: TowersProps): Promise<Metadata> {
  const { locale } = await params;
  const routeSearchParams = await searchParams;
  const i18n: I18n = initLingui(locale);
  let title: string = i18n._(ROUTE_TOWERS.TITLE);

  if (routeSearchParams.room) {
    const room: TowersRoom | null = await prisma.towersRoom.findUnique({
      where: { id: routeSearchParams.room as string },
    });

    if (room) {
      const roomName: string = room.name;
      title = i18n._("Room: {roomName}", { roomName });

      if (routeSearchParams.table) {
        const table: TowersTable | null = await prisma.towersTable.findUnique({
          where: { id: routeSearchParams.table as string },
        });

        if (table) {
          const tableHost: TowersPlayerLite | null = await prisma.towersPlayer.findUnique({
            where: { id: table.hostPlayerId },
            include: getTowersPlayerLiteIncludes(),
          });

          if (tableHost) {
            const tableNumber: number = table.tableNumber;
            const tableHostUsername: string | undefined = tableHost.user.username;
            title += ` - ${i18n._("Table: {tableNumber} - Host: {tableHostUsername}", { tableNumber, tableHostUsername })}`;
          }
        }
      }
    }
  }

  return {
    title,
    alternates: {
      canonical: `${process.env.BASE_URL}${ROUTE_TOWERS.PATH}`,
    },
  };
}

export default async function Towers({ params, searchParams }: TowersProps): Promise<ReactNode> {
  const { locale } = await params;
  const routeSearchParams = await searchParams;
  const i18n: I18n = initLingui(locale);
  const roomId: string = routeSearchParams.room as string;
  const tableId: string = routeSearchParams.table as string;

  if (!roomId && !tableId) {
    return (
      <div className="relative h-full px-4 py-8">
        <h1 className="mb-4 text-3xl">{i18n._(ROUTE_TOWERS.TITLE)}</h1>
        <RoomsList />
      </div>
    );
  }

  return <TowersPageContent />;
}
