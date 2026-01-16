"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx/lite";
import { ProfanityFilter, RoomLevel } from "db/browser";
import { Socket } from "socket.io-client";
import useSWR from "swr";
import { ChatAndPlayersList } from "@/components/game/ChatAndPlayersList";
import { RoomSidebar } from "@/components/game/room/RoomSidebar";
import { RoomTables } from "@/components/game/room/RoomTables";
import RoomHeaderSkeleton from "@/components/skeleton/RoomHeaderSkeleton";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useGame } from "@/context/GameContext";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { fetcher } from "@/lib/fetcher";
import { RoomLitePlainObject, RoomPlainObject } from "@/server/towers/classes/Room";
import { RoomChatMessagePlainObject } from "@/server/towers/classes/RoomChatMessage";
import { RoomPlayerPlainObject } from "@/server/towers/classes/RoomPlayer";
import { TablePlainObject } from "@/server/towers/classes/Table";
import { TablePlayerPlainObject } from "@/server/towers/classes/TablePlayer";
import { TableSeatPlainObject } from "@/server/towers/classes/TableSeat";

const RoomHeader = dynamic(() => import("@/components/game/room/RoomHeader"), {
  loading: () => <RoomHeaderSkeleton />,
});

export default function Room(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId: string | null = searchParams.get("room");

  if (!roomId) {
    throw new Error("Room ID is required");
  }

  const { socketRef, isConnected, session } = useSocket();
  const { addJoinedRoom } = useGame();
  const joinedRoomSidebarRef = useRef<Set<string>>(new Set<string>());
  const [roomInfo, setRoomInfo] = useState<RoomLitePlainObject | null>(null);
  const [players, setPlayers] = useState<RoomPlayerPlainObject[]>([]);
  const [chatMessages, setChatMessages] = useState<RoomChatMessagePlainObject[]>([]);
  const [tables, setTables] = useState<TablePlainObject[]>([]);
  const [avatarId, setAvatarId] = useState<string>("001");
  const [profanityFilter, setProfanityFilter] = useState<ProfanityFilter>(ProfanityFilter.WEAK);
  const isSocialRoom: boolean = roomInfo?.level === RoomLevel.SOCIAL;

  const {
    data: roomResponse,
    error: roomError,
    mutate: loadRoom,
  } = useSWR<ApiResponse<RoomPlainObject>>(`/api/games/towers/rooms/${roomId}`, fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateOnReconnect: true,
  });

  const { data: settingsResponse } = useSWR<ApiResponse<{ avatarId: string; profanityFilter: ProfanityFilter }>>(
    `/api/users/${session?.user.id}/settings`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  useEffect(() => {
    if (roomInfo && !joinedRoomSidebarRef.current.has(roomInfo.id)) {
      joinedRoomSidebarRef.current.add(roomInfo.id);
      addJoinedRoom({ id: roomInfo.id, name: roomInfo.name, basePath: ROUTE_TOWERS.PATH });
    }
  }, [roomInfo]);

  useEffect(() => {
    if (roomResponse?.success && roomResponse.data) {
      const roomData: RoomPlainObject = roomResponse.data;
      setRoomInfo({
        id: roomData.id,
        name: roomData.name,
        level: roomData.level,
      });
      setPlayers(roomData.players || []);
      setChatMessages(roomData.chatMessages || []);
      setTables(roomData.tables || []);
    }
  }, [roomResponse]);

  useEffect(() => {
    if ((settingsResponse?.success, settingsResponse?.data)) {
      setAvatarId(settingsResponse.data.avatarId);
      setProfanityFilter(settingsResponse.data.profanityFilter);
    }
  }, [settingsResponse?.data]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const emitInitialData = (): void => {
      socket.emit(ClientToServerEvents.ROOM_JOIN, { roomId }, (response: SocketCallback<RoomPlainObject>) => {
        if (response.success && response.data) {
          // TODO: Switch to loadRoom when db logic will be implemented
          // await loadRoom();
          const roomData: RoomPlainObject = response.data;
          setRoomInfo({
            id: roomData.id,
            name: roomData.name,
            level: roomData.level,
          });
          setPlayers(roomData.players || []);
          setChatMessages(roomData.chatMessages || []);
          setTables(roomData.tables || []);
        } else {
          router.push(ROUTE_TOWERS.PATH);
        }
      });
    };

    const handlePlayerJoinRoom = ({ roomPlayer }: { roomPlayer: RoomPlayerPlainObject }): void => {
      setPlayers((prev: RoomPlayerPlainObject[]) => {
        const isPlayerExists: boolean = prev.some((rp: RoomPlayerPlainObject) => rp.playerId === roomPlayer.playerId);
        if (isPlayerExists) return prev;
        return [...prev, roomPlayer];
      });
    };

    const handlePlayerLeaveRoom = ({ roomPlayer }: { roomPlayer: RoomPlayerPlainObject }): void => {
      setPlayers((prev: RoomPlayerPlainObject[]) =>
        prev.filter((rp: RoomPlayerPlainObject) => rp.playerId !== roomPlayer.playerId),
      );
    };

    const handleUpdateChatMessages = ({ chatMessage }: { chatMessage: RoomChatMessagePlainObject }): void => {
      setChatMessages((prev: RoomChatMessagePlainObject[]) => {
        if (prev.some((rcm: RoomChatMessagePlainObject) => rcm.id === chatMessage.id)) return prev;
        return [...prev, chatMessage];
      });
    };

    const handleUpdateTable = ({ table }: { table: TablePlainObject }): void => {
      setTables((prev: TablePlainObject[]) => {
        const existingTableIndex: number = prev.findIndex((t: TablePlainObject) => t.id === table.id);
        if (existingTableIndex !== -1) {
          const updatedTables: TablePlainObject[] = [...prev];
          updatedTables[existingTableIndex] = { ...prev[existingTableIndex], ...table };
          return updatedTables;
        }
        return [...prev, table];
      });
    };

    const handlePlayerJoinTable = ({ tablePlayer }: { tablePlayer: TablePlayerPlainObject }): void => {
      setTables((prev: TablePlainObject[]) =>
        prev.map((table: TablePlainObject) => {
          if (table.id !== tablePlayer.tableId) return table;

          const isAlreadyInTable: boolean = table.players.some(
            (tp: TablePlayerPlainObject) => tp.playerId === tablePlayer.playerId,
          );
          if (isAlreadyInTable) return table;

          return { ...table, players: [...table.players, tablePlayer] };
        }),
      );

      setPlayers((prev: RoomPlayerPlainObject[]) =>
        prev.map((rp: RoomPlayerPlainObject) =>
          rp.playerId === tablePlayer.playerId ? { ...rp, tableNumber: tablePlayer.table.tableNumber } : rp,
        ),
      );
    };

    const handlePlayerLeaveTable = ({ tablePlayer }: { tablePlayer: TablePlayerPlainObject }): void => {
      setTables((prev: TablePlainObject[]) =>
        prev.map((table: TablePlainObject) =>
          table.id === tablePlayer.tableId
            ? {
                ...table,
                players: table.players.filter((tp: TablePlayerPlainObject) => tp.playerId !== tablePlayer.playerId),
              }
            : table,
        ),
      );

      setPlayers((prev: RoomPlayerPlainObject[]) =>
        prev.map((rp: RoomPlayerPlainObject) =>
          rp.playerId === tablePlayer.playerId ? { ...rp, tableNumber: null } : rp,
        ),
      );
    };

    const handleUpdateTableSeat = ({
      tableSeat,
      tablePlayer,
    }: {
      tableSeat: TableSeatPlainObject
      tablePlayer: TablePlayerPlainObject
    }) => {
      setTables((prev: TablePlainObject[]) =>
        prev.map((table: TablePlainObject) => {
          if (table.id === tableSeat.tableId) {
            return {
              ...table,
              seats: table.seats.map((ts: TableSeatPlainObject) => (ts.id === tableSeat.id ? tableSeat : ts)),
              players: table.players.map((tp: TablePlayerPlainObject) =>
                tp.playerId === tablePlayer.playerId ? { ...tp, seatNumber: tablePlayer.seatNumber } : tp,
              ),
            };
          }
          return table;
        }),
      );
    };

    const handleDeleteTable = ({ tableId }: { tableId: string }): void => {
      setTables((prev: TablePlainObject[]) => prev.filter((t: TablePlainObject) => t.id !== tableId));
    };

    const attachListeners = (): void => {
      socket.on(ServerToClientEvents.ROOM_PLAYER_JOINED, handlePlayerJoinRoom);
      socket.on(ServerToClientEvents.ROOM_PLAYER_LEFT, handlePlayerLeaveRoom);
      socket.on(ServerToClientEvents.ROOM_MESSAGE_SENT, handleUpdateChatMessages);
      socket.on(ServerToClientEvents.TABLE_UPDATED, handleUpdateTable);
      socket.on(ServerToClientEvents.TABLE_PLAYER_JOINED, handlePlayerJoinTable);
      socket.on(ServerToClientEvents.TABLE_PLAYER_LEFT, handlePlayerLeaveTable);
      socket.on(ServerToClientEvents.TABLE_SEAT_UPDATED, handleUpdateTableSeat);
      socket.on(ServerToClientEvents.TABLE_DELETED, handleDeleteTable);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.ROOM_PLAYER_JOINED, handlePlayerJoinRoom);
      socket.off(ServerToClientEvents.ROOM_PLAYER_LEFT, handlePlayerLeaveRoom);
      socket.off(ServerToClientEvents.ROOM_MESSAGE_SENT, handleUpdateChatMessages);
      socket.off(ServerToClientEvents.TABLE_UPDATED, handleUpdateTable);
      socket.off(ServerToClientEvents.TABLE_PLAYER_JOINED, handlePlayerJoinTable);
      socket.off(ServerToClientEvents.TABLE_PLAYER_LEFT, handlePlayerLeaveTable);
      socket.off(ServerToClientEvents.TABLE_SEAT_UPDATED, handleUpdateTableSeat);
      socket.off(ServerToClientEvents.TABLE_DELETED, handleDeleteTable);
    };

    const onConnect = (): void => {
      attachListeners();
      emitInitialData();
    };

    if (socket.connected) {
      onConnect();
    } else {
      socket.once("connect", onConnect);
    }

    return () => {
      socket.off("connect", onConnect);
      detachListeners();
    };
  }, [isConnected, roomId]);

  if (roomError) return <div>Error: {roomError.message}</div>;

  return (
    <div
      className={clsx(
        "grid [grid-template-areas:'banner_banner_banner''sidebar_content_content''sidebar_content_content'] grid-rows-(--grid-rows-game) grid-cols-(--grid-cols-game) w-full h-full bg-gray-100",
        "dark:bg-dark-game-background",
      )}
    >
      <RoomHeader room={roomInfo} />

      <RoomSidebar
        roomId={roomId}
        isSocialRoom={isSocialRoom}
        avatarId={avatarId}
        profanityFilter={profanityFilter}
        onSetProfanityFilter={setProfanityFilter}
      />

      <div className="[grid-area:content] grid [grid-template-areas:'tables''chat'] grid-rows-(--grid-rows-game-content) gap-2 px-2 pb-2">
        <RoomTables roomId={roomId} tables={tables} players={players} />

        <ChatAndPlayersList
          roomId={roomId}
          isSocialRoom={isSocialRoom}
          chatMessages={chatMessages}
          profanityFilter={profanityFilter}
          players={players}
        />
      </div>
    </div>
  );
}
