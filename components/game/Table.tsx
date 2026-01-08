"use client";

import React, { ChangeEvent, FormEvent, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Plural, Trans, Select as TransSelect, useLingui } from "@lingui/react/macro";
import { Type } from "@sinclair/typebox";
import { Value, ValueError } from "@sinclair/typebox/value";
import clsx from "clsx/lite";
import { RoomLevel, TableInvitationStatus } from "db/browser";
import { TableChatMessageType } from "db/browser";
import { TableType } from "db/browser";
import { GameState } from "db/browser";
import { Socket } from "socket.io-client";
import useSWR from "swr";
import TableBootUserModal from "@/components/game/TableBootUserModal";
import TableChangeKeysPanel from "@/components/game/TableChangeKeysPanel";
import TableGameDemoPanel from "@/components/game/TableGameDemoPanel";
import TableInviteUserModal from "@/components/game/TableInviteUserModal";
import Timer from "@/components/game/Timer";
import ChatSkeleton from "@/components/skeleton/ChatSkeleton";
import PlayersListSkeleton from "@/components/skeleton/PlayersListSkeleton";
import ServerMessageSkeleton from "@/components/skeleton/ServerMessageSkeleton";
import TableHeaderSkeleton from "@/components/skeleton/TableHeaderSkeleton";
import PlayerBoard from "@/components/towers/PlayerBoard";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { InputImperativeHandle } from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { FKey, fKeyMessages } from "@/constants/f-key-messages";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useGame } from "@/context/GameContext";
import { useModal } from "@/context/ModalContext";
import { useSocket } from "@/context/SocketContext";
import { TablePanelView } from "@/enums/table-panel-view";
import { SocketCallback } from "@/interfaces/socket";
import { ServerTowersSeat, ServerTowersTeam } from "@/interfaces/table-seats";
import { fetcher } from "@/lib/fetcher";
import { getReadableKeyLabel } from "@/lib/keyboard/get-readable-key-label";
import { logger } from "@/lib/logger";
import { PlayerControlKeysPlainObject } from "@/server/towers/classes/PlayerControlKeys";
import { TableLitePlainObject, TablePlainObject } from "@/server/towers/classes/Table";
import { TableChatMessagePlainObject } from "@/server/towers/classes/TableChatMessage";
import { TableInvitationPlainObject } from "@/server/towers/classes/TableInvitation";
import { TablePlayerPlainObject } from "@/server/towers/classes/TablePlayer";
import { TableSeatPlainObject } from "@/server/towers/classes/TableSeat";
import { PowerBarItemPlainObject } from "@/server/towers/game/PowerBar";
import { groupAndStructureSeats } from "@/utils/get-structured-teams";

const TableHeader = dynamic(() => import("@/components/game/TableHeader"), {
  loading: () => <TableHeaderSkeleton />,
});

const ServerMessage = dynamic(() => import("@/components/game/ServerMessage"), {
  ssr: false,
  loading: () => <ServerMessageSkeleton />,
});

const Chat = dynamic(() => import("@/components/game/Chat"), {
  loading: () => <ChatSkeleton />,
});

const PlayersList = dynamic(() => import("@/components/game/PlayersList"), {
  loading: () => <PlayersListSkeleton />,
});

const changeTableOptionsSchema = Type.Object({
  tableType: Type.Union([
    Type.Literal(TableType.PUBLIC),
    Type.Literal(TableType.PROTECTED),
    Type.Literal(TableType.PRIVATE),
  ]),
  isRated: Type.Boolean(),
});

type ChangeTableOptionsPayload = FormPayload<typeof changeTableOptionsSchema>;
type ChangeTableOptionsFormValidationErrors = FormValidationErrors<keyof ChangeTableOptionsPayload>;

export default function Table(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId: string | null = searchParams.get("room");
  const tableId: string | null = searchParams.get("table");

  if (!roomId || !tableId) {
    throw new Error("Room ID and Table ID are required");
  }

  const { i18n, t } = useLingui();
  const { socketRef, isConnected, session } = useSocket();
  const { addJoinedTable, removeJoinedTable } = useGame();
  const { openModal } = useModal();
  const joinedTableSidebarRef = useRef<Set<string>>(new Set<string>());
  const formRef = useRef<HTMLFormElement>(null);
  const messageInputRef = useRef<InputImperativeHandle>(null);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [tableInfo, setTableInfo] = useState<TableLitePlainObject | null>(null);
  const [players, setPlayers] = useState<TablePlayerPlainObject[]>([]);
  const [chatMessages, setChatMessages] = useState<TableChatMessagePlainObject[]>([]);
  const [seats, setSeats] = useState<TableSeatPlainObject[]>([]);
  const [invitations, setInvitations] = useState<TableInvitationPlainObject[]>([]);
  const [currentTablePlayer, setCurrentTablePlayer] = useState<TablePlayerPlainObject>();
  const [uiSeats, setUISeats] = useState<ServerTowersTeam[]>([]);
  const [gameState, setGameState] = useState<GameState>(GameState.WAITING);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [winnersCount, setWinnersCount] = useState<number>(0);
  const [firstWinner, setFirstWinner] = useState<string | undefined>(undefined);
  const [secondWinner, setSecondWinner] = useState<string | undefined>(undefined);
  const [isWinner, setIsWinner] = useState<boolean>(false);
  const [isPlayedThisRound, setIsPlayedThisRound] = useState<boolean>(false);
  const [errorMessages, setErrorMessages] = useState<ChangeTableOptionsFormValidationErrors>({});
  const [gameOverAnimationClass, setGameOverAnimationClass] = useState("animate-move-up");
  const [view, setView] = useState<TablePanelView>(TablePanelView.GAME);
  const [controlKeys, setControlKeys] = useState<PlayerControlKeysPlainObject | null>(null);
  const [seatNumber, setSeatNumber] = useState<number | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [nextPowerBarItem, setNextPowerBarItem] = useState<PowerBarItemPlainObject | undefined>(undefined);
  const [usedPowerItem, setUsedPowerItem] = useState<
    { sourceUsername: string; targetUsername: string; powerItem: PowerBarItemPlainObject } | undefined
  >(undefined);
  const [usedPowerItemTextOpacity, setUsedPowerItemTextOpacity] = useState<number>(1);
  const isSocialRoom: boolean = tableInfo?.room?.level === RoomLevel.SOCIAL;

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
      setSeatNumber(currentTablePlayer.seatNumber ?? null);
      setIsReady(currentTablePlayer.isReady);
    }
  }, [currentTablePlayer]);

  const isSitAccessGranted = useMemo(() => {
    if (!currentTablePlayer?.playerId) return false;

    // If user is already seated, they keep access
    if (currentTablePlayer?.seatNumber !== null) return true;

    // Table host
    if (tableInfo?.hostPlayerId === currentTablePlayer?.playerId) return true;

    // Public table
    if (tableInfo?.tableType === TableType.PUBLIC) return true;

    // Protected or Private → invitation required
    return !!invitations.some(
      (ti: TableInvitationPlainObject) =>
        ti.inviteePlayerId === session?.user.id && ti.status === TableInvitationStatus.ACCEPTED,
    );
  }, [tableInfo, invitations, currentTablePlayer]);

  useEffect(() => {
    if (!seats) return;
    setUISeats(groupAndStructureSeats(seats, seatNumber));
  }, [seats, seatNumber]);

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
    if (gameState === GameState.GAME_OVER) {
      const timer: NodeJS.Timeout = setTimeout(() => {
        setGameOverAnimationClass("animate-move-down");
      }, 9000);

      return () => clearTimeout(timer);
    } else if (gameOverAnimationClass === "animate-move-down") {
      setGameOverAnimationClass("animate-move-up");
    }
  }, [gameState]);

  useEffect(() => {
    setUsedPowerItemTextOpacity(1);

    let current: number = 1.0;
    const step: number = 0.04; // Decrease by 4% at a time
    const min: number = 0.6;

    const interval: NodeJS.Timeout = setInterval(() => {
      current = Math.max(min, current - step);
      setUsedPowerItemTextOpacity(current);

      if (current <= min) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [usedPowerItem]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const emitInitialData = (): void => {
      socket.emit(
        ClientToServerEvents.TABLE_JOIN,
        { tableId },
        async (response: SocketCallback<TablePlainObject>): Promise<void> => {
          if (response.success && response.data) {
            setIsJoined(true);

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
      setChatMessages((prev: TableChatMessagePlainObject[]) => [...prev, chatMessage]);
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

    const handleTimer = ({ timer }: { timer: number }): void => {
      setTimer(timer);
    };

    const handlePowerFire = ({
      sourceUsername,
      targetUsername,
      targetSeatNumber,
      powerItem,
    }: {
      sourceUsername: string
      targetUsername: string
      targetSeatNumber: number
      powerItem: PowerBarItemPlainObject
    }): void => {
      if (seatNumber === targetSeatNumber) {
        socket.emit(ClientToServerEvents.GAME_POWER_APPLY, { sourceUsername, targetUsername, powerItem });
      }

      setUsedPowerItem({ sourceUsername, targetUsername, powerItem });
    };

    const handleGameOver = ({
      winners,
      isWinner,
      isPlayedThisRound,
    }: {
      winners: TablePlayerPlainObject[]
      isWinner: boolean
      isPlayedThisRound: boolean
    }): void => {
      setWinnersCount(winners?.length);

      switch (winners.length) {
        case 1:
          setFirstWinner(winners[0].player.user.username);
          break;
        case 2:
          setFirstWinner(winners[0].player.user.username);
          setSecondWinner(winners[1].player.user.username);
          break;
        default:
          setFirstWinner(undefined);
          setSecondWinner(undefined);
          break;
      }

      setIsWinner(isWinner);
      setIsPlayedThisRound(isPlayedThisRound);
    };

    const attachListeners = (): void => {
      socket.on(ServerToClientEvents.TABLE_UPDATED, handleUpdateTable);
      socket.on(ServerToClientEvents.TABLE_SEAT_UPDATED, handleUpdateTableSeat);
      socket.on(ServerToClientEvents.TABLE_PLAYER_JOINED, handlePlayerJoin);
      socket.on(ServerToClientEvents.TABLE_PLAYER_LEFT, handlePlayerLeave);
      socket.on(ServerToClientEvents.TABLE_PLAYER_UPDATED, handleUpdateTablePlayer);
      socket.on(ServerToClientEvents.TABLE_MESSAGE_SENT, handleUpdateChatMessages);
      socket.on(ServerToClientEvents.GAME_CONTROL_KEYS_UPDATED, handleUpdateControlKeys);
      socket.on(ServerToClientEvents.GAME_SEATS, handleGameSeats);
      socket.on(ServerToClientEvents.GAME_STATE, handleGameState);
      socket.on(ServerToClientEvents.GAME_COUNTDOWN, handleCountdown);
      socket.on(ServerToClientEvents.GAME_TIMER, handleTimer);
      socket.on(ServerToClientEvents.GAME_POWER_FIRE, handlePowerFire);
      socket.on(ServerToClientEvents.GAME_OVER, handleGameOver);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.TABLE_UPDATED, handleUpdateTable);
      socket.off(ServerToClientEvents.TABLE_SEAT_UPDATED, handleUpdateTableSeat);
      socket.off(ServerToClientEvents.TABLE_PLAYER_JOINED, handlePlayerJoin);
      socket.off(ServerToClientEvents.TABLE_PLAYER_LEFT, handlePlayerLeave);
      socket.off(ServerToClientEvents.TABLE_PLAYER_UPDATED, handleUpdateTablePlayer);
      socket.off(ServerToClientEvents.TABLE_MESSAGE_SENT, handleUpdateChatMessages);
      socket.off(ServerToClientEvents.GAME_CONTROL_KEYS_UPDATED, handleUpdateControlKeys);
      socket.off(ServerToClientEvents.GAME_SEATS, handleGameSeats);
      socket.off(ServerToClientEvents.GAME_STATE, handleGameState);
      socket.off(ServerToClientEvents.GAME_COUNTDOWN, handleCountdown);
      socket.off(ServerToClientEvents.GAME_TIMER, handleTimer);
      socket.off(ServerToClientEvents.GAME_POWER_FIRE, handlePowerFire);
      socket.off(ServerToClientEvents.GAME_OVER, handleGameOver);
    };

    const onConnect = (): void => {
      attachListeners();
      if (!isJoined) emitInitialData();
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
  }, [isConnected, tableId, isJoined]);

  const seatedTeamsCount = useMemo(() => {
    const seatedTeams: Set<number> = new Set<number>();

    if (!uiSeats || uiSeats.length === 0) return 0;

    uiSeats.forEach((team: ServerTowersTeam) => {
      const hasSeatedPlayer: boolean = team.seats.some((seat: ServerTowersSeat) => !!seat.occupiedByPlayerId);
      if (hasSeatedPlayer) {
        seatedTeams.add(team.teamNumber);
      }
    });

    return seatedTeams.size;
  }, [uiSeats]);

  const handleOptionChange = (): void => {
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }, 1500);
  };

  const handleFormValidation = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const formElement: EventTarget & HTMLFormElement = event.currentTarget;
    const formData: FormData = new FormData(formElement);
    const payload: ChangeTableOptionsPayload = {
      tableType: formData.get("tableType") as TableType,
      isRated: formData.get("isRated") === "on",
    };
    const errors: ValueError[] = Array.from(Value.Errors(changeTableOptionsSchema, payload));

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "tableType":
          setErrorMessages((prev: ChangeTableOptionsFormValidationErrors) => ({
            ...prev,
            tableType: t({ message: "You must select a table type." }),
          }));
          break;
        case "isRated":
          setErrorMessages((prev: ChangeTableOptionsFormValidationErrors) => ({
            ...prev,
            isRated: t({ message: "You must rate this game." }),
          }));
          break;
        default:
          logger.warn(`Change Table Options Validation: Unknown error at ${error.path}`);
          break;
      }
    }

    if (Object.keys(errorMessages).length === 0) {
      handleChangeTableOptions(payload);
    }
  };

  const handleChangeTableOptions = (body: ChangeTableOptionsPayload): void => {
    if (!tableInfo) return;

    const payload: {
      tableId: string
      tableType?: TableType
      isRated?: boolean
    } = {
      tableId,
    };

    if (body.tableType !== tableInfo.tableType) {
      payload.tableType = body.tableType;
    }

    if (body.isRated !== tableInfo.isRated) {
      payload.isRated = body.isRated;
    }

    if (typeof payload.tableType !== "undefined" || typeof payload.isRated !== "undefined") {
      socketRef.current?.emit(ClientToServerEvents.TABLE_UPDATE_SETTINGS, payload);
    }
  };

  const handleOpenInviteUserModal = (): void => {
    openModal(TableInviteUserModal, {
      roomId,
      tableId,
      isRatingsVisible: !isSocialRoom,
    });
  };

  const handleOpenBootUserModal = (): void => {
    openModal(TableBootUserModal, {
      roomId,
      tableId,
      hostId: tableInfo?.hostPlayerId,
      isRatingsVisible: !isSocialRoom,
    });
  };

  const handleSit = (seatNumber: number): void => {
    socketRef.current?.emit(ClientToServerEvents.SEAT_SIT, { tableId, seatNumber });
  };

  const handleStand = (): void => {
    socketRef.current?.emit(ClientToServerEvents.SEAT_STAND, { tableId });
  };

  const handleStart = (): void => {
    socketRef.current?.emit(ClientToServerEvents.SEAT_READY, { tableId });
  };

  const updateTablePlayer = (tablePlayer: TablePlayerPlainObject): void => {
    if (tablePlayer.playerId === session?.user.id) {
      setCurrentTablePlayer(tablePlayer);
    }
  };

  const handleSendMessage = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" && messageInputRef.current?.value) {
      const text: string = messageInputRef.current.value.trim();

      if (text !== "") {
        socketRef.current?.emit(
          ClientToServerEvents.TABLE_MESSAGE_SEND,
          { tableId, text },
          (response: SocketCallback) => {
            if (response.success) {
              messageInputRef.current?.clear();
            }
          },
        );
      }
    }
  };

  const handleQuitTable = (): void => {
    socketRef.current?.emit(ClientToServerEvents.TABLE_LEAVE, { tableId }, (response: SocketCallback) => {
      if (response.success) {
        removeJoinedTable(tableId);
        router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}`);
      }
    });
  };

  const renderNextPowerBarItemText = (item: PowerBarItemPlainObject | undefined): ReactNode => {
    if (!item || !("powerType" in item)) return null;

    if (item.letter === "SD") {
      return <Trans>You can use a special cell</Trans>;
    }

    const { letter, powerType, powerLevel } = item;

    // Attack powers
    if (powerType === "attack") {
      if (letter === "Y") {
        return <Trans>You can add a row</Trans>;
      } else if (letter === "O") {
        return (
          <TransSelect
            value={powerLevel}
            _minor="You can minorly dither"
            _mega="You can mega dither"
            other="You can dither"
          />
        );
      } else if (letter === "U") {
        return (
          <TransSelect
            value={powerLevel}
            _minor="You can add a stone"
            _normal="You can add 2 stones"
            _mega="You can add 3 stones"
            other="You can add stones"
          />
        );
      } else if (letter === "P") {
        return (
          <TransSelect
            value={powerLevel}
            _minor="You can minorly defuse"
            _mega="You can mega defuse"
            other="You can defuse"
          />
        );
      } else if (letter === "I") {
        return <Trans>You can send a Medusa piece</Trans>;
      } else if (letter === "!") {
        return (
          <TransSelect
            value={powerLevel}
            _minor="You can minorly remove powers"
            _mega="You can mega remove powers"
            other="You can remove powers"
          />
        );
      }
    }

    // Defense powers
    if (powerType === "defense") {
      if (letter === "Y") {
        return <Trans>You can remove a row</Trans>;
      } else if (letter === "O") {
        return (
          <TransSelect
            value={powerLevel}
            _minor="You can minorly clump"
            _mega="You can mega clump"
            other="You can clump"
          />
        );
      } else if (letter === "U") {
        return (
          <TransSelect
            value={powerLevel}
            _minor="You can drop a stone"
            _normal="You can drop 2 stones"
            _mega="You can drop 3 stones"
            other="You can drop stones"
          />
        );
      } else if (letter === "P") {
        return <Trans>You can color blast</Trans>;
      } else if (letter === "I") {
        return <Trans>You can send a Midas piece</Trans>;
      } else if (letter === "!") {
        return <Trans>You can send a color plague</Trans>;
      }
    }

    return null;
  };

  const renderUsedPowerItemText = (
    obj: { sourceUsername: string; targetUsername: string; powerItem: PowerBarItemPlainObject } | undefined,
  ): ReactNode => {
    if (!obj) return null;

    const { sourceUsername, targetUsername, powerItem } = obj;

    if (powerItem.letter === "SD") {
      return (
        <Trans>
          {sourceUsername} used a special cell on {targetUsername}
        </Trans>
      );
    }

    const { letter, powerType, powerLevel } = powerItem;

    // Attack
    if (powerType === "attack") {
      if (letter === "Y") {
        return (
          <Trans>
            {sourceUsername} added a row to {targetUsername}
          </Trans>
        );
      } else if (letter === "O") {
        return (
          <TransSelect
            value={powerLevel}
            _minor={`${sourceUsername} minorly dithered ${targetUsername}`}
            _mega={`${sourceUsername} mega dithered ${targetUsername}`}
            other={`${sourceUsername} dithered ${targetUsername}`}
          />
        );
      } else if (letter === "U") {
        return (
          <Trans>
            {sourceUsername} stoned {targetUsername}
          </Trans>
        );
      } else if (letter === "P") {
        return (
          <TransSelect
            value={powerLevel}
            _minor={`${sourceUsername} minorly defused ${targetUsername}`}
            _mega={`${sourceUsername} mega defused ${targetUsername}`}
            other={`${sourceUsername} defused ${targetUsername}`}
          />
        );
      } else if (letter === "I") {
        return (
          <Trans>
            {sourceUsername} sent a Medusa piece to {targetUsername}
          </Trans>
        );
      } else if (letter === "!") {
        return (
          <Trans>
            {sourceUsername} removed powers from {targetUsername}
          </Trans>
        );
      }
    }

    // Defense
    if (powerType === "defense") {
      if (letter === "Y") {
        return (
          <Trans>
            {sourceUsername} removed a row from {targetUsername}
          </Trans>
        );
      } else if (letter === "O") {
        return (
          <Trans>
            {sourceUsername} clumped {targetUsername}
          </Trans>
        );
      } else if (letter === "U") {
        const value: number | undefined =
          powerLevel === "minor" ? 1 : powerLevel === "normal" ? 2 : powerLevel === "mega" ? 3 : undefined;
        return (
          <Plural
            value={value}
            one={`${sourceUsername} dropped 1 stone for ${targetUsername}`}
            two={`${sourceUsername} dropped 2 stones for ${targetUsername}`}
            _3={`${sourceUsername} dropped 3 stones for ${targetUsername}`}
            other={`${sourceUsername} dropped stones for ${targetUsername}`}
          />
        );
      } else if (letter === "P") {
        return (
          <Trans>
            {sourceUsername} color blasted {targetUsername}
          </Trans>
        );
      } else if (letter === "I") {
        return (
          <Trans>
            {sourceUsername} sent a Midas piece to {targetUsername}
          </Trans>
        );
      } else if (letter === "!") {
        return (
          <Trans>
            {sourceUsername} sent a color plague to {targetUsername}
          </Trans>
        );
      }
    }

    return null;
  };

  if (tableError) return <div>Error: {tableError.message}</div>;

  return (
    <form ref={formRef} className="flex h-full" noValidate onSubmit={handleFormValidation}>
      <div
        className={clsx(
          "grid [grid-template-areas:'banner_banner_banner''sidebar_content_content''sidebar_content_content'] grid-rows-(--grid-rows-game) grid-cols-(--grid-cols-game) w-full h-full",
          "dark:bg-dark-game-background",
        )}
      >
        <TableHeader room={tableInfo?.room} table={tableInfo} />

        {/* Left sidebar */}
        <div
          className={clsx(
            "[grid-area:sidebar] flex flex-col justify-between p-2 bg-gray-200",
            "dark:bg-dark-game-sidebar-background",
          )}
        >
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={!isConnected || !seatNumber || isReady || gameState === GameState.PLAYING}
              onClick={handleStart}
            >
              <Trans>Start</Trans>
            </Button>
            <hr className={clsx("border-1 border-gray-400", "dark:border-slate-500")} />
            <Button
              className="w-full"
              disabled={!isConnected || view === TablePanelView.CHANGE_KEYS || gameState === GameState.PLAYING}
              onClick={() => setView(TablePanelView.CHANGE_KEYS)}
            >
              <Trans>Change Keys</Trans>
            </Button>
            <Button
              className="w-full"
              disabled={!isConnected || view === TablePanelView.DEMO || gameState === GameState.PLAYING}
              onClick={() => setView(TablePanelView.DEMO)}
            >
              <Trans>Demo</Trans>
            </Button>
            <hr className={clsx("border-1 border-gray-400", "dark:border-slate-500")} />
            <Button className="w-full" disabled={!isConnected || !seatNumber} onClick={handleStand}>
              <Trans>Stand</Trans>
            </Button>
            <div>
              <span className="p-1 rounded-tl-sm rounded-tr-sm bg-sky-700 text-white text-sm">
                <Trans>Table Type</Trans>
              </span>
            </div>
            <Select
              id="tableType"
              defaultValue={tableInfo?.tableType}
              disabled={!isConnected || session?.user.id !== tableInfo?.hostPlayerId}
              isNoBottomSpace
              onChange={() => {
                handleOptionChange();
              }}
            >
              <Select.Option value={TableType.PUBLIC}>
                <Trans>Public</Trans>
              </Select.Option>
              <Select.Option value={TableType.PROTECTED}>
                <Trans>Protected</Trans>
              </Select.Option>
              <Select.Option value={TableType.PRIVATE}>
                <Trans>Private</Trans>
              </Select.Option>
            </Select>
            <Button
              className="w-full"
              disabled={!isConnected || session?.user.id !== tableInfo?.hostPlayerId}
              onClick={handleOpenInviteUserModal}
            >
              <Trans>Invite</Trans>
            </Button>
            <Button
              className="w-full"
              disabled={!isConnected || session?.user.id !== tableInfo?.hostPlayerId}
              onClick={handleOpenBootUserModal}
            >
              <Trans>Boot</Trans>
            </Button>
            <div>
              <span className="p-1 rounded-tl-sm rounded-tr-sm bg-sky-700 text-white text-sm">
                <Trans>Options</Trans>
              </span>
            </div>
            {!isSocialRoom && (
              <Checkbox
                id="isRated"
                label={t({ message: "Rated Game" })}
                defaultChecked={tableInfo?.isRated}
                disabled={
                  !isConnected ||
                  session?.user.id !== tableInfo?.hostPlayerId ||
                  gameState === GameState.COUNTDOWN ||
                  gameState === GameState.PLAYING
                }
                isNoBottomSpace
                onChange={handleOptionChange}
              />
            )}
            <Checkbox
              id="sound"
              label={t({ message: "Sound" })}
              disabled
              isNoBottomSpace
              onChange={(event: ChangeEvent<HTMLInputElement>) => console.log(event.target.checked)}
            />
          </div>
          <div className="flex gap-1">
            <Button className="w-full" disabled onClick={(_: MouseEvent<HTMLButtonElement>) => {}}>
              <Trans>Help</Trans>
            </Button>
            <Button className="w-full" onClick={handleQuitTable}>
              <Trans>Quit</Trans>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="[grid-area:content] grid [grid-template-areas:'seats''chat'] grid-rows-(--grid-rows-game-content) gap-2 px-2 pb-2">
          {view === TablePanelView.CHANGE_KEYS ? (
            <TableChangeKeysPanel controlKeys={controlKeys} onChangeView={() => setView(TablePanelView.GAME)} />
          ) : view === TablePanelView.DEMO ? (
            <TableGameDemoPanel nextGameCountdown={countdown} onChangeView={() => setView(TablePanelView.GAME)} />
          ) : (
            <div
              className={clsx(
                "[grid-area:seats] flex flex-col border border-gray-200",
                "dark:border-dark-game-content-border",
              )}
            >
              <div
                className={clsx(
                  "flex items-center w-full h-full border border-gray-200",
                  "dark:border-dark-game-content-border",
                )}
              >
                <div className="relative grid [grid-template-areas:'timer_team1_team3''timer_team1_team3''team2_team1_team4''team2_hint_team4'] grid-cols-(--grid-cols-table-team) w-fit p-2 mx-auto">
                  {/* Game countdown */}
                  {gameState === GameState.COUNTDOWN && countdown !== null && (
                    <div
                      className={clsx(
                        "absolute start-1/2 -translate-x-1/2 bottom-[8px] z-game-overlay flex flex-col items-center w-[450px] h-48 p-1 border-2 border-gray-400 bg-gray-200 shadow-lg",
                        "dark:bg-slate-700",
                        "rtl:translate-x-1/2",
                      )}
                    >
                      <Trans>
                        <div className="text-2xl">The next game is starting in</div>
                        <div className="flex-1 flex items-center text-7xl text-orange-400 font-semibold normal-nums">
                          {countdown}
                        </div>
                        <div className="text-2xl">
                          <Plural value={countdown} one="second" other="seconds" />
                        </div>
                      </Trans>
                    </div>
                  )}

                  {/* Game over */}
                  {gameState === GameState.GAME_OVER && (
                    <div
                      className={clsx(
                        "absolute start-0 top-0 gap-8 z-game-overlay flex flex-col justify-start items-center w-full h-max p-1 mt-16 font-medium [text-shadow:_4px_4px_0_rgb(0_0_0)]",
                        gameOverAnimationClass,
                      )}
                    >
                      <div className="text-8xl text-fuchsia-600">
                        <Trans>Game Over</Trans>
                      </div>

                      {isPlayedThisRound && !isWinner && (
                        <div className="text-6xl text-yellow-400">
                          <Trans>You lose!</Trans>
                        </div>
                      )}

                      <div className="flex flex-col gap-8 items-center text-6xl text-center">
                        {isPlayedThisRound && isWinner && (
                          <div className="text-yellow-400">
                            <Trans>You win!</Trans>
                          </div>
                        )}
                        {winnersCount > 0 && (
                          <div className="text-fuchsia-600">
                            <Plural
                              value={winnersCount}
                              one={`Congratulations\n${firstWinner}`}
                              other={`Congratulations\n${firstWinner} and ${secondWinner}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Controls and game timer */}
                  <div className="[grid-area:timer] flex flex-col justify-evenly items-start gap-2 px-2 pb-2 text-lg">
                    <div className="text-sm">
                      <div className="grid grid-cols-[1fr_1fr] gap-2">
                        <div>
                          <Trans>Left:</Trans>
                        </div>{" "}
                        <div className={clsx("text-gray-500", "dark:text-dark-text-muted")}>
                          {getReadableKeyLabel(i18n, controlKeys?.moveLeft)}
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr] gap-2">
                        <div>
                          <Trans>Right:</Trans>
                        </div>{" "}
                        <div className={clsx("text-gray-500", "dark:text-dark-text-muted")}>
                          {getReadableKeyLabel(i18n, controlKeys?.moveRight)}
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr] gap-2">
                        <div>
                          <Trans>Drop:</Trans>
                        </div>{" "}
                        <div className={clsx("text-gray-500", "dark:text-dark-text-muted")}>
                          {getReadableKeyLabel(i18n, controlKeys?.dropPiece)}
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr] gap-2">
                        <div>
                          <Trans>Cycle Color:</Trans>
                        </div>{" "}
                        <div className={clsx("text-gray-500", "dark:text-dark-text-muted")}>
                          {getReadableKeyLabel(i18n, controlKeys?.cycleBlock)}
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr] gap-2">
                        <div>
                          <Trans>Use Item:</Trans>
                        </div>{" "}
                        <div className={clsx("text-gray-500", "dark:text-dark-text-muted")}>
                          {getReadableKeyLabel(i18n, controlKeys?.useItem)}
                        </div>
                      </div>
                    </div>
                    <Timer timer={timer} />
                  </div>

                  {/* Game */}
                  {uiSeats.map((group: ServerTowersTeam, index: number) => {
                    const isPlayerSeated: boolean = uiSeats.some((team: ServerTowersTeam) =>
                      team.seats.some((seat: ServerTowersSeat) => seat.occupiedByPlayerId === session?.user.id),
                    );

                    return (
                      <div
                        key={index}
                        className={clsx(index === 0 && "flex flex-row justify-center items-start h-max")}
                        style={{ gridArea: `team${index + 1}` }}
                        dir="ltr"
                      >
                        <div className={index === 0 ? "contents" : "flex flex-row justify-center items-center"}>
                          {group.seats.map((seat: ServerTowersSeat) => {
                            const tablePlayerForSeat: TablePlayerPlainObject | undefined = players.find(
                              (tp: TablePlayerPlainObject) => tp.playerId === seat.occupiedByPlayerId,
                            );

                            return (
                              <PlayerBoard
                                key={seat.seatNumber}
                                roomId={roomId}
                                tableId={tableId}
                                seat={seat}
                                isOpponentBoard={index !== 0}
                                gameState={gameState}
                                isSitAccessGranted={isSitAccessGranted}
                                seatedTeamsCount={seatedTeamsCount}
                                isPlayerSeated={isPlayerSeated}
                                tablePlayerForSeat={tablePlayerForSeat}
                                isRatingsVisible={!isSocialRoom}
                                onSit={handleSit}
                                onStand={handleStand}
                                onStart={handleStart}
                                onNextPowerBarItem={(nextPowerBarItem: PowerBarItemPlainObject | undefined) =>
                                  setNextPowerBarItem(nextPowerBarItem)
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <div
                    className={clsx(
                      "[grid-area:hint] row-span-1 flex flex-col justify-start w-[488px] px-2 mt-2 bg-neutral-200 text-sm font-mono",
                      "dark:bg-slate-700",
                    )}
                  >
                    {/* Next power to be used by current player */}
                    <span className="w-full min-h-5 truncate">{renderNextPowerBarItemText(nextPowerBarItem)}</span>
                    {/* Power used by other players */}
                    <span
                      className="w-full min-h-5 text-gray-700 truncate"
                      style={{ opacity: usedPowerItemTextOpacity }}
                    >
                      {renderUsedPowerItemText(usedPowerItem)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat and users list */}
          <div className="[grid-area:chat] flex gap-2">
            <div
              className={clsx(
                "overflow-hidden flex-1 flex flex-col gap-1 border border-gray-200 bg-white",
                "dark:border-dark-game-content-border dark:bg-dark-game-chat-background",
              )}
            >
              <ServerMessage />

              {/* Chat */}
              <div className="overflow-hidden flex flex-col gap-1 h-full px-2">
                <Chat
                  chatMessages={chatMessages}
                  messageInputRef={messageInputRef}
                  isMessageInputDisabled={!isConnected}
                  onSendMessage={handleSendMessage}
                />
              </div>
            </div>

            <div className="w-[385px]">
              <PlayersList roomId={roomId} players={players} isRatingsVisible={!isSocialRoom} />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
