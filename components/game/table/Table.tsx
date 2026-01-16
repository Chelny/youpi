"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx/lite";
import { RoomLevel } from "db/browser";
import { TableChatMessageType } from "db/browser";
import { GameState } from "db/browser";
import { Socket } from "socket.io-client";
import useSWR from "swr";
import { ChatAndPlayersList } from "@/components/game/ChatAndPlayersList";
import TableChangeKeysPanel from "@/components/game/table/TableChangeKeysPanel";
import { TableControlsAndTimer } from "@/components/game/table/TableControlsAndTimer";
import { TableCountdownOverlay } from "@/components/game/table/TableCountdownOverlay";
import TableGameDemoPanel from "@/components/game/table/TableGameDemoPanel";
import { TableGameOverOverlay } from "@/components/game/table/TableGameOverOverlay";
import { TableGamePowerActions } from "@/components/game/table/TableGamePowerActions";
import { TableSeats } from "@/components/game/table/TableSeats";
import { TableSidebar } from "@/components/game/table/TableSidebar";
import TableHeaderSkeleton from "@/components/skeleton/TableHeaderSkeleton";
import { FKey, fKeyMessages } from "@/constants/f-key-messages";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useGame } from "@/context/GameContext";
import { useSocket } from "@/context/SocketContext";
import { TablePanelView } from "@/enums/table-panel-view";
import { SocketCallback } from "@/interfaces/socket";
import { fetcher } from "@/lib/fetcher";
import { PlayerControlKeysPlainObject } from "@/server/towers/classes/PlayerControlKeys";
import { TableLitePlainObject, TablePlainObject } from "@/server/towers/classes/Table";
import { TableChatMessagePlainObject } from "@/server/towers/classes/TableChatMessage";
import { TableInvitationPlainObject } from "@/server/towers/classes/TableInvitation";
import { TablePlayerPlainObject } from "@/server/towers/classes/TablePlayer";
import { TableSeatPlainObject } from "@/server/towers/classes/TableSeat";
import { PowerBarItemPlainObject } from "@/server/towers/game/PowerBar";

const TableHeader = dynamic(() => import("@/components/game/TableHeader"), {
  loading: () => <TableHeaderSkeleton />,
});

export default function Table(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId: string | null = searchParams.get("room");
  const tableId: string | null = searchParams.get("table");

  if (!roomId || !tableId) {
    throw new Error("Room ID and Table ID are required");
  }

  const { socketRef, isConnected, session } = useSocket();
  const { addJoinedTable } = useGame();
  const joinedTableSidebarRef = useRef<Set<string>>(new Set<string>());
  const [tableInfo, setTableInfo] = useState<TableLitePlainObject | null>(null);
  const [players, setPlayers] = useState<TablePlayerPlainObject[]>([]);
  const [chatMessages, setChatMessages] = useState<TableChatMessagePlainObject[]>([]);
  const [seats, setSeats] = useState<TableSeatPlainObject[]>([]);
  const [invitations, setInvitations] = useState<TableInvitationPlainObject[]>([]);
  const [currentTablePlayer, setCurrentTablePlayer] = useState<TablePlayerPlainObject>();
  const [gameState, setGameState] = useState<GameState>(GameState.WAITING);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [panelView, setPanelView] = useState<TablePanelView>(TablePanelView.GAME);
  const [controlKeys, setControlKeys] = useState<PlayerControlKeysPlainObject | null>(null);
  const [seatNumber, setSeatNumber] = useState<number | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [nextPowerBarItem, setNextPowerBarItem] = useState<PowerBarItemPlainObject | undefined>(undefined);
  const isSocialRoom: boolean = tableInfo?.room?.level === RoomLevel.SOCIAL;
  const [isTableHydrated, setIsTableHydrated] = useState<boolean>(false);

  const {
    data: tableResponse,
    error: tableError,
    mutate: loadTable,
  } = useSWR<ApiResponse<TablePlainObject>>(`/api/games/towers/tables/${tableId}`, fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateOnReconnect: true,
  });

  useEffect(() => {
    if (tableInfo && !joinedTableSidebarRef.current.has(tableInfo.id)) {
      joinedTableSidebarRef.current.add(tableInfo.id);
      addJoinedTable({
        id: tableInfo.id,
        roomId: tableInfo.roomId,
        roomName: tableInfo.room.name,
        tableNumber: tableInfo.tableNumber,
      });
    }
  }, [tableInfo]);

  useEffect(() => {
    if (tableResponse?.success && tableResponse.data) {
      // Hide PlayerBoardSkeleton
      setIsTableHydrated(true);

      const tableData: TablePlainObject = tableResponse.data;
      setTableInfo({
        id: tableData.id,
        roomId: tableData.roomId,
        room: tableData.room,
        tableNumber: tableData.tableNumber,
        hostPlayerId: tableData.hostPlayerId,
        hostPlayer: tableData.hostPlayer,
        tableType: tableData.tableType,
        isRated: tableData.isRated,
      });
      setPlayers(tableData.players || []);
      setChatMessages(tableData.chatMessages || []);
      setSeats(tableData.seats || []);
      setInvitations(tableData.invitations || []);
      setCurrentTablePlayer(
        tableResponse.data?.players.find((tp: TablePlayerPlainObject) => tp.playerId === session?.user.id),
      );
    }
  }, [tableResponse]);

  useEffect(() => {
    if (!currentTablePlayer) {
      setSeatNumber(null);
      setIsReady(false);
    } else {
      setSeatNumber(currentTablePlayer.seatNumber);
      setIsReady(currentTablePlayer.isReady);
    }
  }, [currentTablePlayer]);

  useEffect(() => {
    const handleFKeyMessage = (event: KeyboardEvent): void => {
      const keyCode: FKey = event.code as FKey;

      if (keyCode in fKeyMessages) {
        event.preventDefault();
        socketRef.current?.emit(
          ClientToServerEvents.TABLE_MESSAGE_SEND,
          {
            tableId,
            type: TableChatMessageType.F_KEY,
            textVariables: { username: session?.user.username, fKey: keyCode },
          },
          () => {},
        );
      }
    };

    window.addEventListener("keydown", handleFKeyMessage);

    return () => {
      window.removeEventListener("keydown", handleFKeyMessage);
    };
  }, [roomId, tableId]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const emitInitialData = (): void => {
      socket.emit(
        ClientToServerEvents.TABLE_JOIN,
        { tableId },
        async (response: SocketCallback<TablePlainObject>): Promise<void> => {
          if (response.success && response.data) {
            // Hide PlayerBoardSkeleton
            setIsTableHydrated(true);

            // TODO: Switch to loadRoom when db logic will be implemented
            // await loadTable();

            const tableData: TablePlainObject = response.data;
            setTableInfo({
              id: tableData.id,
              roomId: tableData.roomId,
              room: tableData.room,
              tableNumber: tableData.tableNumber,
              hostPlayerId: tableData.hostPlayerId,
              hostPlayer: tableData.hostPlayer,
              tableType: tableData.tableType,
              isRated: tableData.isRated,
            });
            setPlayers(tableData.players || []);
            setChatMessages(tableData.chatMessages || []);
            setSeats(tableData.seats || []);
            setInvitations(tableData.invitations || []);

            // TODO: Delete when API will be used
            setCurrentTablePlayer(
              response.data?.players.find((tp: TablePlayerPlainObject) => tp.playerId === session?.user.id),
            );

            socket.emit(
              ClientToServerEvents.GAME_CONTROL_KEYS,
              { playerId: session?.user.id },
              (response: SocketCallback<PlayerControlKeysPlainObject>) => {
                if (response.success && response.data) {
                  setControlKeys(response.data);
                }
              },
            );
          } else {
            router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}`);
          }
        },
      );
    };

    const handleUpdateTable = ({ table }: { table: TablePlainObject }): void => {
      setTableInfo({
        id: table.id,
        roomId: table.roomId,
        room: table.room,
        tableNumber: table.tableNumber,
        hostPlayerId: table.hostPlayerId,
        hostPlayer: table.hostPlayer,
        tableType: table.tableType,
        isRated: table.isRated,
      });
    };

    const handleUpdateTableSeat = ({
      tableSeat,
      tablePlayer,
    }: {
      tableSeat: TableSeatPlainObject
      tablePlayer: TablePlayerPlainObject
    }): void => {
      setSeats((prev: TableSeatPlainObject[]) =>
        prev.map((ts: TableSeatPlainObject) => (ts.id === tableSeat.id ? tableSeat : ts)),
      );

      setPlayers((prev: TablePlayerPlainObject[]) =>
        prev.map((tp: TablePlayerPlainObject) => (tp.playerId === tablePlayer.playerId ? tablePlayer : tp)),
      );

      updateTablePlayer(tablePlayer);
    };

    const handlePlayerJoin = ({ tablePlayer }: { tablePlayer: TablePlayerPlainObject }): void => {
      setPlayers((prev: TablePlayerPlainObject[]) => {
        const isPlayerExists: boolean = prev.some((tp: TablePlayerPlainObject) => tp.playerId === tablePlayer.playerId);
        if (isPlayerExists) return prev;
        return [...prev, tablePlayer];
      });

      updateTablePlayer(tablePlayer);
    };

    const handlePlayerLeave = ({ tablePlayer }: { tablePlayer: TablePlayerPlainObject }): void => {
      setPlayers((prev: TablePlayerPlainObject[]) =>
        prev.filter((tp: TablePlayerPlainObject) => tp.playerId !== tablePlayer.playerId),
      );
      updateTablePlayer(tablePlayer);
    };

    const handleUpdateTablePlayer = ({ tablePlayer }: { tablePlayer: TablePlayerPlainObject }): void => {
      setPlayers((prev: TablePlayerPlainObject[]) =>
        prev.map((tp: TablePlayerPlainObject) => (tp.playerId === tablePlayer.playerId ? tablePlayer : tp)),
      );

      updateTablePlayer(tablePlayer);
    };

    const handleUpdateChatMessages = ({ chatMessage }: { chatMessage: TableChatMessagePlainObject }): void => {
      setChatMessages((prev: TableChatMessagePlainObject[]) => {
        if (prev.some((tcm: TableChatMessagePlainObject) => tcm.id === chatMessage.id)) return prev;
        return [...prev, chatMessage];
      });
    };

    const handleUpdateControlKeys = ({ controlKeys }: { controlKeys: PlayerControlKeysPlainObject }): void => {
      setControlKeys(controlKeys);
    };

    const handleGameSeats = ({ tableSeats }: { tableSeats: TableSeatPlainObject[] }): void => {
      setSeats(tableSeats);
    };

    const handleGameState = ({ gameState }: { gameState: GameState }): void => {
      setGameState(gameState);
    };

    const handleCountdown = ({ countdown }: { countdown: number }): void => {
      setCountdown(countdown);
    };

    const attachListeners = (): void => {
      socket.on(ServerToClientEvents.TABLE_UPDATED, handleUpdateTable);
      socket.on(ServerToClientEvents.TABLE_SEAT_UPDATED, handleUpdateTableSeat);
      socket.on(ServerToClientEvents.TABLE_PLAYER_JOINED, handlePlayerJoin);
      socket.on(ServerToClientEvents.TABLE_PLAYER_LEFT, handlePlayerLeave);
      socket.on(ServerToClientEvents.TABLE_PLAYER_UPDATED, handleUpdateTablePlayer);
      socket.on(ServerToClientEvents.TABLE_MESSAGE_SENT, handleUpdateChatMessages);
      socket.on(ServerToClientEvents.GAME_CONTROL_KEYS_UPDATED, handleUpdateControlKeys);
      socket.on(ServerToClientEvents.GAME_TABLE_SEATS_UPDATED, handleGameSeats);
      socket.on(ServerToClientEvents.GAME_STATE_UPDATED, handleGameState);
      socket.on(ServerToClientEvents.GAME_COUNTDOWN_UPDATED, handleCountdown);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.TABLE_UPDATED, handleUpdateTable);
      socket.off(ServerToClientEvents.TABLE_SEAT_UPDATED, handleUpdateTableSeat);
      socket.off(ServerToClientEvents.TABLE_PLAYER_JOINED, handlePlayerJoin);
      socket.off(ServerToClientEvents.TABLE_PLAYER_LEFT, handlePlayerLeave);
      socket.off(ServerToClientEvents.TABLE_PLAYER_UPDATED, handleUpdateTablePlayer);
      socket.off(ServerToClientEvents.TABLE_MESSAGE_SENT, handleUpdateChatMessages);
      socket.off(ServerToClientEvents.GAME_CONTROL_KEYS_UPDATED, handleUpdateControlKeys);
      socket.off(ServerToClientEvents.GAME_TABLE_SEATS_UPDATED, handleGameSeats);
      socket.off(ServerToClientEvents.GAME_STATE_UPDATED, handleGameState);
      socket.off(ServerToClientEvents.GAME_COUNTDOWN_UPDATED, handleCountdown);
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
  }, [isConnected, tableId]);

  const handleSit = (seatNumber: number): void => {
    socketRef.current?.emit(ClientToServerEvents.TABLE_SEAT_SIT, { tableId, seatNumber });
  };

  const handleStand = (): void => {
    socketRef.current?.emit(ClientToServerEvents.TABLE_SEAT_STAND, { tableId });
  };

  const handleStart = (): void => {
    socketRef.current?.emit(ClientToServerEvents.TABLE_SEAT_READY, { tableId });
  };

  const updateTablePlayer = (tablePlayer: TablePlayerPlainObject): void => {
    if (tablePlayer.playerId === session?.user.id) {
      setCurrentTablePlayer(tablePlayer);
    }
  };

  if (tableError) return <div>Error: {tableError.message}</div>;

  return (
    <div
      className={clsx(
        "grid [grid-template-areas:'banner_banner_banner''sidebar_content_content''sidebar_content_content'] grid-rows-(--grid-rows-game) grid-cols-(--grid-cols-game) w-full h-full",
        "dark:bg-dark-game-background",
      )}
    >
      <TableHeader room={tableInfo?.room} table={tableInfo} />

      <TableSidebar
        roomId={roomId}
        isSocialRoom={isSocialRoom}
        tableId={tableId}
        tableInfo={tableInfo}
        gameState={gameState}
        seatNumber={seatNumber}
        isReady={isReady}
        panelView={panelView}
        onStand={handleStand}
        onStartGame={handleStart}
        onChangePanelView={setPanelView}
      />

      {/* Content */}
      <div className="[grid-area:content] grid [grid-template-areas:'seats''chat'] grid-rows-(--grid-rows-game-content) gap-2 px-2 pb-2">
        {panelView === TablePanelView.CHANGE_KEYS ? (
          <TableChangeKeysPanel controlKeys={controlKeys} onChangeView={() => setPanelView(TablePanelView.GAME)} />
        ) : panelView === TablePanelView.DEMO ? (
          <TableGameDemoPanel nextGameCountdown={countdown} onChangeView={() => setPanelView(TablePanelView.GAME)} />
        ) : (
          <div
            className={clsx(
              "[grid-area:seats] flex items-center w-full h-full border border-gray-200",
              "dark:border-dark-game-content-border",
            )}
          >
            <div className="relative grid [grid-template-areas:'timer_team1_team3''timer_team1_team3''team2_team1_team4''team2_hint_team4'] grid-cols-(--grid-cols-table-team) w-fit p-2 mx-auto">
              <TableCountdownOverlay gameState={gameState} countdown={countdown} />
              <TableGameOverOverlay gameState={gameState} />

              <TableControlsAndTimer controlKeys={controlKeys} />

              <TableSeats
                isTableHydrated={isTableHydrated}
                roomId={roomId}
                tableId={tableId}
                isSocialRoom={isSocialRoom}
                tableInfo={tableInfo}
                seats={seats}
                players={players}
                invitations={invitations}
                currentTablePlayer={currentTablePlayer}
                seatNumber={seatNumber}
                gameState={gameState}
                onSit={handleSit}
                onStand={handleStand}
                onStartGame={handleStart}
                onSetNextPowerBarItem={setNextPowerBarItem}
              />

              <TableGamePowerActions tableId={tableId} seatNumber={seatNumber} nextPowerBarItem={nextPowerBarItem} />
            </div>
          </div>
        )}

        <ChatAndPlayersList
          roomId={roomId}
          tableId={tableId}
          isSocialRoom={isSocialRoom}
          chatMessages={chatMessages}
          players={players}
        />
      </div>
    </div>
  );
}
