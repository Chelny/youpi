"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plural, useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { RoomLevel, TowersRoomPlayer } from "db/browser";
import { Socket } from "socket.io-client";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useSocket } from "@/context/SocketContext";
import { fetcher } from "@/lib/fetcher";
import { SocketListener } from "@/lib/socket/socket-listener";
import { TowersRoomsListWithCount } from "@/types/prisma";
import { getRoomLevelText } from "@/utils/room";

export default function RoomsList(): ReactNode {
  const router = useRouter();
  const { t } = useLingui();
  const { socketRef, isConnected, session } = useSocket();
  const [rooms, setRooms] = useState<TowersRoomsListWithCount[]>([]);

  const {
    data: roomsResponse,
    error: roomsError,
    mutate: loadRooms,
  } = useSWR<ApiResponse<TowersRoomsListWithCount[]>>("/api/games/towers/rooms", fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  useEffect(() => {
    if (roomsResponse?.success && roomsResponse.data) {
      setRooms(roomsResponse.data);
    }
  }, [roomsResponse]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const socketListener: SocketListener = new SocketListener(socket);

    const handleUpdateRoomslist = async (): Promise<void> => {
      await loadRooms();
    };

    const attachListeners = (): void => {
      socketListener.on(ServerToClientEvents.ROOMS_LIST_UPDATED, handleUpdateRoomslist);
    };

    const onConnect = (): void => {
      attachListeners();
    };

    if (socket.connected) {
      onConnect();
    } else {
      socketListener.on("connect", onConnect);
    }

    return () => {
      socketListener.dispose();
    };
  }, [isConnected, socketRef]);

  const groupedRoomsList = useMemo(() => {
    const roomsListMap: Map<RoomLevel, TowersRoomsListWithCount[]> = new Map<RoomLevel, TowersRoomsListWithCount[]>();

    for (const room of rooms ?? []) {
      const key: RoomLevel = room.level;
      if (!roomsListMap.has(key)) roomsListMap.set(key, []);
      roomsListMap.get(key)!.push(room);
    }

    for (const [key, list] of roomsListMap) {
      roomsListMap.set(key, list);
    }

    return [...roomsListMap.entries()].map(([level, list]: [RoomLevel, TowersRoomsListWithCount[]]) => ({
      level,
      rooms: list,
    }));
  }, [rooms]);

  const handleJoinRoom = (roomId: string): void => {
    router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}`);
  };

  if (roomsError) return <div>Error: {roomsError.message}</div>;

  return (
    <div className="flex flex-col gap-10">
      {groupedRoomsList.map(({ level, rooms: levelRooms }: { level: RoomLevel; rooms: TowersRoomsListWithCount[] }) => (
        <section key={level} className="flex flex-col gap-4">
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">{getRoomLevelText(level)}</h3>
            </div>
          </div>

          <ul className="grid grid-cols-[repeat(auto-fill,_minmax(14rem,_1fr))] gap-8">
            {levelRooms.map((room: TowersRoomsListWithCount) => {
              const usersCount: number = room._count.players;
              const isUserInRoom: boolean = room.players?.some(
                (roomPlayer: TowersRoomPlayer) => roomPlayer.playerId === session?.user?.id,
              );

              return (
                <li
                  key={room.id}
                  className={clsx(
                    "flex flex-col gap-2 p-4 border border-gray-300 rounded-sm bg-white",
                    room.isFull && "has-[button:disabled]:opacity-50",
                    "dark:border-dark-card-border dark:bg-dark-card-background",
                  )}
                >
                  <div className="font-medium">{room.name}</div>

                  <div>
                    <Plural value={usersCount} zero="no users" one="# user" other="# users" />
                  </div>

                  <div>
                    <Button
                      type="button"
                      className={clsx("place-self-end w-full", room.isFull && "hover:cursor-not-allowed")}
                      disabled={room.isFull || isUserInRoom}
                      onClick={() => !room.isFull && handleJoinRoom(room.id)}
                    >
                      {isUserInRoom
                        ? t({ message: "Joined" })
                        : room.isFull
                          ? t({ message: "Full" })
                          : t({ message: "Join" })}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
