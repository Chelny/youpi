import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import RoomTableSkeleton from "@/components/skeleton/RoomTableSkeleton";
import { useSocket } from "@/context/SocketContext";
import { RoomPlayerPlainObject } from "@/server/towers/classes/RoomPlayer";
import { TablePlainObject } from "@/server/towers/classes/Table";

const RoomTable = dynamic(() => import("@/components/game/room/RoomTable"), {
  loading: () => <RoomTableSkeleton />,
});

type RoomTablesProps = {
  roomId: string
  tables: TablePlainObject[]
  players: RoomPlayerPlainObject[]
};

export function RoomTables({ roomId, tables, players }: RoomTablesProps): ReactNode {
  const { session } = useSocket();

  return (
    <div
      className={clsx(
        "[grid-area:tables] overflow-hidden flex flex-col border border-gray-200 bg-white",
        "dark:border-dark-game-content-border dark:bg-dark-game-content-background",
      )}
    >
      <div className={clsx("flex gap-1 py-2 bg-yellow-200 text-black", "dark:bg-dark-game-yellow-sub-bar-background")}>
        <div className="flex justify-center items-center w-16 border-gray-300">
          <Trans>Table</Trans>
        </div>
        <div className="flex justify-center items-center w-28 border-gray-300"></div>
        <div className="flex justify-center items-center w-28 border-gray-300">
          <Trans>Team 1-2</Trans>
        </div>
        <div className="flex justify-center items-center w-28 border-gray-300">
          <Trans>Team 3-4</Trans>
        </div>
        <div className="flex justify-center items-center w-28 border-gray-300">
          <Trans>Team 5-6</Trans>
        </div>
        <div className="flex justify-center items-center w-28 border-gray-300">
          <Trans>Team 7-8</Trans>
        </div>
        <div className="flex-1 px-2">
          <Trans>Who is Watching</Trans>
        </div>
      </div>
      <div className="overflow-y-auto">
        {tables.map((table: TablePlainObject) => (
          <RoomTable
            key={table.id}
            roomId={roomId}
            table={table}
            roomPlayer={players.find((rp: RoomPlayerPlainObject) => rp.playerId === session?.user.id)}
          />
        ))}
      </div>
    </div>
  );
}
