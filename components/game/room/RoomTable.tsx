"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { TableType } from "db/browser";
import { Socket } from "socket.io-client";
import Button from "@/components/ui/Button";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { RoomPlayerPlainObject } from "@/server/towers/modules/room-player/room-player.entity";
import { TablePlainObject } from "@/server/towers/modules/table/table.entity";
import { TablePlayerPlainObject } from "@/server/towers/modules/table-player/table-player.entity";

type RoomTableProps = {
  roomId: string
  table: TablePlainObject
  roomPlayer?: RoomPlayerPlainObject
};

export default function RoomTable({ roomId, table, roomPlayer }: RoomTableProps): ReactNode {
  const router = useRouter();
  const { socketRef, isConnected } = useSocket();
  const seatMapping: number[][] = [
    [1, 3, 5, 7],
    [2, 4, 6, 8],
  ];
  const hostUsername: string | null | undefined = table.hostPlayer.user.username;
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const isPrivate: boolean = table.tableType === TableType.PRIVATE;
  const isProtected: boolean = table.tableType === TableType.PROTECTED;
  const isWatchAccessGranted: boolean = !isPrivate || hasAccess;
  const isSitAccessGranted: boolean = (!isPrivate && !isProtected) || hasAccess;

  const handleJoinTable = (seatNumber: number | null = null): void => {
    if (seatNumber) {
      socketRef.current?.emit(
        ClientToServerEvents.TABLE_JOIN,
        { tableId: table.id, seatNumber },
        (response: SocketCallback) => {
          if (response.success) {
            router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}&table=${table.id}`);
          } else {
            router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}`);
          }
        },
      );
    } else {
      router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}&table=${table.id}`);
    }
  };

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const emitInitialData = (): void => {
      socket.emit(
        ClientToServerEvents.TABLE_INVITATION_ACCEPTED_CHECK,
        { tableId: table.id, userId: roomPlayer?.playerId },
        (response: SocketCallback<boolean>) => {
          if (response.success && response.data) {
            setHasAccess(response.data);
          }
        },
      );
    };

    const onConnect = (): void => {
      emitInitialData();
    };

    if (socket.connected) {
      onConnect();
    } else {
      socket.once("connect", onConnect);
    }

    return () => {
      socket.off("connect", onConnect);
    };
  }, [isConnected]);

  return (
    <div className="flex flex-col">
      <div className={clsx("flex items-center border-b border-b-gray-300", "dark:border-b-dark-game-border")}>
        <div
          className={clsx(
            "basis-16 row-span-2 flex justify-center items-center h-full px-2 border-gray-300",
            "dark:border-dark-game-border",
          )}
        >
          #{table.tableNumber}
        </div>
        <div
          className={clsx(
            "flex-1 flex flex-col gap-1 h-full px-2 border-s border-gray-300 divide-y divide-gray-200",
            "dark:border-dark-game-border dark:divide-dark-game-border",
          )}
        >
          <div className="flex flex-1 gap-1 pt-3 pb-2">
            <div className="basis-28">
              <Button
                className="w-full h-full"
                disabled={!isConnected || !isWatchAccessGranted}
                onClick={() => handleJoinTable()}
              >
                <Trans>Watch</Trans>
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              {seatMapping.map((row: number[], rowIndex: number) => (
                <div key={rowIndex} className="flex flex-row gap-1">
                  {row.map((seatNumber: number, colIndex: number) => {
                    const seatedUser: TablePlayerPlainObject | undefined = table?.players.find(
                      (tp: TablePlayerPlainObject) => tp.seatNumber === seatNumber,
                    );

                    return seatedUser ? (
                      <div
                        key={colIndex}
                        className={clsx(
                          "flex items-center justify-center w-28 p-1 border border-gray-300 rounded-sm",
                          "dark:border-dark-game-border",
                        )}
                      >
                        <span className="truncate">{seatedUser.player.user.username}</span>
                      </div>
                    ) : (
                      <Button
                        key={colIndex}
                        className="w-28"
                        disabled={!isConnected || !isSitAccessGranted}
                        onClick={() => handleJoinTable(seatNumber)}
                      >
                        <Trans>Join</Trans>
                      </Button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex-1 px-2 line-clamp-3">
              {/* List non-seated players by username, separated by commas */}
              {table?.players
                .filter((tp: TablePlayerPlainObject) => !tp.seatNumber)
                .map((tp: TablePlayerPlainObject) => tp.player.user.username)
                .join(", ")}
            </div>
          </div>
          <div className="flex py-1 text-sm">
            {table.isRated && (
              <span>
                <Trans>Option: rated</Trans>&nbsp;-&nbsp;
              </span>
            )}
            <span>
              <Trans>Host: {hostUsername}</Trans>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
