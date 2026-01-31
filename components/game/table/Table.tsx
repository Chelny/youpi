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
import { SocketListener } from "@/lib/socket/socket-listener";
import { BoardPlainObject } from "@/server/towers/game/board/board";
import { NextPiecesPlainObject } from "@/server/towers/game/next-pieces";
import { PiecePlainObject } from "@/server/towers/game/pieces/piece";
import { PowerBarItemPlainObject, PowerBarPlainObject } from "@/server/towers/game/power-bar";
import { PlayerControlKeysPlainObject } from "@/server/towers/modules/player-control-keys/player-control-keys.entity";
import { TableLitePlainObject, TablePlainObject } from "@/server/towers/modules/table/table.entity";
import { TableChatMessagePlainObject } from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TableInvitationPlainObject } from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { TablePlayerPlainObject } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeatGamePlainObject, TableSeatPlainObject } from "@/server/towers/modules/table-seat/table-seat.entity";

const TableHeader = dynamic(() => import("@/components/game/TableHeader"), {
  loading: () => <TableHeaderSkeleton />,
});

type SeatGameState = {
  board: BoardPlainObject | null
  nextPieces: NextPiecesPlainObject | null
  powerBar: PowerBarPlainObject | null
  currentPiece: PiecePlainObject | null
};

type GameStateBySeat = Record<number, SeatGameState>;

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
  const [gameStateBySeat, setGameStateBySeat] = useState<GameStateBySeat>({});

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

    const socketListener: SocketListener = new SocketListener(socket);

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
        prev.map((ts: TableSeatPlainObject) =>
          ts.id === tableSeat.id
            ? {
                ...ts,
                occupiedByPlayerId: tableSeat.occupiedByPlayerId,
                occupiedByPlayer: tableSeat.occupiedByPlayer,
              }
            : ts,
        ),
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

    const handleGameState = ({ gameState }: { gameState: GameState }): void => {
      setGameState(gameState);
    };

    const handleCountdown = ({ countdown }: { countdown: number }): void => {
      setCountdown(countdown);
    };

    const handleGameUpdate = ({
      seatNumber,
      nextPieces,
      powerBar,
      board,
      currentPiece,
    }: {
      seatNumber: number
      nextPieces: NextPiecesPlainObject
      powerBar: PowerBarPlainObject
      board: BoardPlainObject
      currentPiece: PiecePlainObject
    }) => {
      setGameStateBySeat((prev: GameStateBySeat) => ({
        ...prev,
        [seatNumber]: {
          board,
          nextPieces,
          powerBar,
          currentPiece,
        },
      }));
    };

    const handleClearGameBoards = ({ tableSeats }: { tableSeats: TableSeatGamePlainObject[] }): void => {
      const newGameStateBySeat: GameStateBySeat = {};

      tableSeats.forEach((seat: TableSeatGamePlainObject) => {
        newGameStateBySeat[seat.seatNumber] = {
          board: seat.board,
          nextPieces: seat.nextPieces,
          powerBar: seat.powerBar,
          currentPiece: null,
        };
      });

      setGameStateBySeat(newGameStateBySeat);
    };

    const attachListeners = (): void => {
      socketListener.on(ServerToClientEvents.TABLE_UPDATED, handleUpdateTable);
      socketListener.on(ServerToClientEvents.TABLE_SEAT_UPDATED, handleUpdateTableSeat);
      socketListener.on(ServerToClientEvents.TABLE_PLAYER_JOINED, handlePlayerJoin);
      socketListener.on(ServerToClientEvents.TABLE_PLAYER_LEFT, handlePlayerLeave);
      socketListener.on(ServerToClientEvents.TABLE_PLAYER_UPDATED, handleUpdateTablePlayer);
      socketListener.on(ServerToClientEvents.TABLE_MESSAGE_SENT, handleUpdateChatMessages);
      socketListener.on(ServerToClientEvents.GAME_CONTROL_KEYS_UPDATED, handleUpdateControlKeys);
      socketListener.on(ServerToClientEvents.GAME_STATE_UPDATED, handleGameState);
      socketListener.on(ServerToClientEvents.GAME_COUNTDOWN_UPDATED, handleCountdown);
      socketListener.on(ServerToClientEvents.GAME_BOARD_UPDATED, handleGameUpdate);
      socketListener.on(ServerToClientEvents.GAME_CLEAR_BOARDS_UPDATED, handleClearGameBoards);
    };

    const onConnect = (): void => {
      attachListeners();
      emitInitialData();
    };

    if (socket.connected) {
      onConnect();
    } else {
      socketListener.on("connect", onConnect);
    }

    return () => {
      socketListener.dispose();
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
                gameStateBySeat={gameStateBySeat}
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
