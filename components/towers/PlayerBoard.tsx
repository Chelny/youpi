"use client";

import { memo, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { GameState } from "db/browser";
import { Socket } from "socket.io-client";
import { AvatarCycler } from "@/components/AvatarCycler";
import PlayerInformationModal from "@/components/game/PlayerInformationModal";
import Grid from "@/components/towers/Grid";
import NextPiece from "@/components/towers/NextPiece";
import PowerBar from "@/components/towers/PowerBar";
import Button from "@/components/ui/Button";
import {
  BLOCK_BREAK_ANIMATION_DURATION_MS,
  MIN_ACTIVE_TEAMS_REQUIRED,
  MIN_ACTIVE_TEAMS_REQUIRED_TEST,
} from "@/constants/game";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useModal } from "@/context/ModalContext";
import { useSocket } from "@/context/SocketContext";
import { useKeyboardActions } from "@/hooks/useKeyboardActions";
import { ServerTowersSeat } from "@/interfaces/table-seats";
import { SocketListener } from "@/lib/socket/socket-listener";
import { BlockToRemove, BoardPlainObject } from "@/server/towers/game/board/board";
import { NextPiecesPlainObject } from "@/server/towers/game/next-pieces";
import { PiecePlainObject } from "@/server/towers/game/pieces/piece";
import { TowersPieceBlockPlainObject } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { PowerBarItemPlainObject, PowerBarPlainObject } from "@/server/towers/game/power-bar";
import { PlayerPlainObject } from "@/server/towers/modules/player/player.entity";
import { PlayerControlKeysPlainObject } from "@/server/towers/modules/player-control-keys/player-control-keys.entity";
import { TEST_MODE } from "@/server/towers/utils/test";
import { Language, languages } from "@/translations/languages";

type PlayerBoardProps = {
  roomId: string
  tableId: string
  seat: ServerTowersSeat
  isOpponentBoard: boolean
  isReversed: boolean
  controlKeys: PlayerControlKeysPlainObject | null
  gameState?: GameState
  isSitAccessGranted: boolean
  seatedTeamsCount: number
  isPlayerSeated: boolean
  isPlayerReady: boolean
  isPlayerPlaying: boolean
  gameStateForSeat?: {
    board: BoardPlainObject | null
    nextPieces: NextPiecesPlainObject | null
    powerBar: PowerBarPlainObject | null
    currentPiece: PiecePlainObject | null
  }
  isRatingsVisible: boolean
  onSit: (seatNumber: number) => void
  onStand: () => void
  onStartGame: () => void
  onNextPowerBarItem: (nextPowerBarItem?: PowerBarItemPlainObject) => void
};

const TYPING_TIMEOUT_MS = 3000;

export default memo(function PlayerBoard({
  roomId,
  tableId,
  seat,
  isOpponentBoard,
  isReversed,
  controlKeys,
  gameState,
  isSitAccessGranted,
  seatedTeamsCount,
  isPlayerSeated,
  isPlayerReady: isReady,
  isPlayerPlaying: isPlaying,
  gameStateForSeat,
  isRatingsVisible,
  onSit,
  onStand,
  onStartGame,
  onNextPowerBarItem,
}: PlayerBoardProps): ReactNode {
  const { socketRef, isConnected, session } = useSocket();
  const { t } = useLingui();
  const { openModal } = useModal();
  const boardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [blocksToRemove, setBlocksToRemove] = useState<BlockToRemove[]>([]);
  const typedRef = useRef<string>("");
  const typingTimerRef = useRef<NodeJS.Timeout>(null);
  const isSeatAvailable: boolean =
    (gameState === GameState.WAITING && !seat.occupiedByPlayer && !isPlayerSeated) ||
    (gameState === GameState.PLAYING && !seat.occupiedByPlayer && !isPlayerSeated);
  const isCurrentUserSeat: boolean = seat.occupiedByPlayerId === session?.user?.id;
  const isCurrentUserSeated: boolean = isCurrentUserSeat && !isReady && !isPlaying;
  const isPlayerReady: boolean =
    gameState === GameState.WAITING &&
    !!seat.occupiedByPlayer &&
    isReady &&
    !isPlaying &&
    seatedTeamsCount >= (TEST_MODE ? MIN_ACTIVE_TEAMS_REQUIRED_TEST : MIN_ACTIVE_TEAMS_REQUIRED);
  const isPlayerWaitingForMorePlayers: boolean =
    gameState === GameState.WAITING &&
    !!seat.occupiedByPlayer &&
    isReady &&
    !isPlaying &&
    seatedTeamsCount < (TEST_MODE ? MIN_ACTIVE_TEAMS_REQUIRED_TEST : MIN_ACTIVE_TEAMS_REQUIRED);
  const isPlayerWaitingForNextGame: boolean =
    gameState === GameState.PLAYING && !!seat.occupiedByPlayer && !isCurrentUserSeat && !isReady && !isPlaying;
  const board: BoardPlainObject | null = gameStateForSeat?.board ?? null;
  const nextPieces: NextPiecesPlainObject | null = isCurrentUserSeat ? (gameStateForSeat?.nextPieces ?? null) : null;
  const powerBar: PowerBarPlainObject | null = isCurrentUserSeat ? (gameStateForSeat?.powerBar ?? null) : null;
  const currentPiece: PiecePlainObject | null =
    isCurrentUserSeat && isPlaying ? (gameStateForSeat?.currentPiece ?? null) : null;
  const currentLanguage: Language | undefined = languages.find(
    (language: Language) => language.locale === session?.user.language,
  );

  const handlePlayerUsernameKeyDown = useKeyboardActions({
    onEnter: () => seat.occupiedByPlayer && handleOpenPlayerInfoModal(seat.occupiedByPlayer),
    onSpace: () => seat.occupiedByPlayer && handleOpenPlayerInfoModal(seat.occupiedByPlayer),
    onKeyI: () => seat.occupiedByPlayer && handleOpenPlayerInfoModal(seat.occupiedByPlayer),
  });

  const handleOpenPlayerInfoModal = (selectedPlayer: PlayerPlainObject): void => {
    openModal(PlayerInformationModal, { roomId, selectedPlayer, isRatingsVisible });
  };

  const mapKeyCodeToChar = (
    seatNumber: number,
    controlKeys: PlayerControlKeysPlainObject | null,
  ): string | undefined => {
    let code: string | undefined;

    switch (seatNumber) {
      case 1:
        code = controlKeys?.useItemOnPlayer1 ?? "1";
        break;
      case 2:
        code = controlKeys?.useItemOnPlayer2 ?? "2";
        break;
      case 3:
        code = controlKeys?.useItemOnPlayer3 ?? "3";
        break;
      case 4:
        code = controlKeys?.useItemOnPlayer4 ?? "4";
        break;
      case 5:
        code = controlKeys?.useItemOnPlayer5 ?? "5";
        break;
      case 6:
        code = controlKeys?.useItemOnPlayer6 ?? "6";
        break;
      case 7:
        code = controlKeys?.useItemOnPlayer7 ?? "7";
        break;
      case 8:
        code = controlKeys?.useItemOnPlayer8 ?? "8";
        break;
      default:
        code = undefined;
    }

    if (!code) return undefined;

    // Strip Key/Digit prefix
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    return code;
  };

  const handleMovePiece = (direction: "left" | "right"): void => {
    socketRef.current?.emit(ClientToServerEvents.GAME_PIECE_MOVE, { tableId, direction });
  };

  const handleCyclePiece = (): void => {
    socketRef.current?.emit(ClientToServerEvents.GAME_PIECE_CYCLE, { tableId });
  };

  const handleDropPiece = (): void => {
    socketRef.current?.emit(ClientToServerEvents.GAME_PIECE_DROP, { tableId });
  };

  const handleStopDropPiece = (): void => {
    socketRef.current?.emit(ClientToServerEvents.GAME_PIECE_DROP_STOP, { tableId });
  };

  const handleUsePowerItem = (targetSeatNumber?: number): void => {
    socketRef.current?.emit(ClientToServerEvents.GAME_POWER_USE, { tableId, targetSeatNumber });
  };

  const seatKeyLabel = useMemo(() => mapKeyCodeToChar(seat.seatNumber, controlKeys), [seat.seatNumber, controlKeys]);

  useEffect(() => {
    // Set focus on correct seat when game starts
    if (gameState === GameState.PLAYING) {
      const boardEl: HTMLDivElement | null = isCurrentUserSeat ? boardRefs.current[seat.seatNumber - 1] : null;
      boardEl?.focus();
    }
  }, [gameState]);

  useEffect(() => {
    if (isCurrentUserSeat) {
      onNextPowerBarItem(powerBar?.nextItem);
    }
  }, [isCurrentUserSeat, nextPieces]);

  useEffect(() => {
    if (!controlKeys) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isCurrentUserSeat || !isPlaying || board?.isGameOver) return;

      const keyMap: { [key: string]: () => void } = {
        [controlKeys.moveLeft]: () => handleMovePiece("left"),
        [controlKeys.moveRight]: () => handleMovePiece("right"),
        [controlKeys.cycleBlock]: handleCyclePiece,
        [controlKeys.dropPiece]: handleDropPiece,
        [controlKeys.useItem]: handleUsePowerItem,
        [controlKeys.useItemOnPlayer1]: () => handleUsePowerItem(1),
        [controlKeys.useItemOnPlayer2]: () => handleUsePowerItem(2),
        [controlKeys.useItemOnPlayer3]: () => handleUsePowerItem(3),
        [controlKeys.useItemOnPlayer4]: () => handleUsePowerItem(4),
        [controlKeys.useItemOnPlayer5]: () => handleUsePowerItem(5),
        [controlKeys.useItemOnPlayer6]: () => handleUsePowerItem(6),
        [controlKeys.useItemOnPlayer7]: () => handleUsePowerItem(7),
        [controlKeys.useItemOnPlayer8]: () => handleUsePowerItem(8),
      };

      if (keyMap[event.code]) {
        event.preventDefault();
        keyMap[event.code]();
      }
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (!isCurrentUserSeat || !isPlaying || board?.isGameOver) return;

      if (event.code === controlKeys.dropPiece) {
        handleStopDropPiece();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [controlKeys, isPlaying, board]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!socket) return;

    if (!isCurrentUserSeated) {
      typedRef.current = "";
      clearTimeout(typingTimerRef.current!);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const key: string = event.key?.toUpperCase();

      if (!/^[A-Z0-9 ]$/.test(key)) return;

      const activeElement: Element | null = document.activeElement;

      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement instanceof HTMLElement && activeElement.isContentEditable))
      ) {
        return;
      }

      typedRef.current += key;

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

      typingTimerRef.current = setTimeout(() => {
        typedRef.current = "";
      }, TYPING_TIMEOUT_MS);

      socket.emit(ClientToServerEvents.TABLE_HERO_CODE, { tableId, code: typedRef.current });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      typedRef.current = "";
    };
  }, [tableId, isCurrentUserSeated]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const socketListener: SocketListener = new SocketListener(socket);

    const handleHooSendBlocks = ({
      teamNumber,
      blocks,
    }: {
      teamNumber: number
      blocks: TowersPieceBlockPlainObject[]
    }): void => {
      if (!isCurrentUserSeat) return;
      if (teamNumber === seat.teamNumber) return;
      socket.emit(ClientToServerEvents.GAME_HOO_ADD_BLOCKS, { tableId, teamNumber, blocks });
    };

    const handleBlocksMarkedForRemoval = async ({
      seatNumber,
      blocks,
    }: {
      seatNumber: number
      blocks: BlockToRemove[]
    }): Promise<void> => {
      if (seatNumber !== seat.seatNumber) return;

      setBlocksToRemove(blocks);
      await new Promise<void>((resolve) => setTimeout(resolve, BLOCK_BREAK_ANIMATION_DURATION_MS));
      setBlocksToRemove([]);

      socket.emit(ClientToServerEvents.GAME_CLIENT_BLOCKS_ANIMATION_DONE);
    };

    const attachListeners = (): void => {
      socketListener.on(ServerToClientEvents.GAME_HOO_SEND_BLOCKS, handleHooSendBlocks);
      socketListener.on(ServerToClientEvents.GAME_BLOCKS_MARKED_FOR_REMOVAL, handleBlocksMarkedForRemoval);
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
  }, [isConnected, tableId, seat.seatNumber, seat.teamNumber, isCurrentUserSeat]);

  return (
    <div className={clsx("flex flex-col", isOpponentBoard && "w-player-board-opponent-width")}>
      <div
        className={clsx(
          "grid gap-1",
          !isOpponentBoard ? "h-6" : "h-4",
          !isOpponentBoard &&
            isReversed &&
            "grid-cols-[1fr_max-content] ps-0 pe-2 rtl:grid-cols-[max-content_1fr] rtl:ps-2 rtl:pe-0",
          !isOpponentBoard &&
            !isReversed &&
            "grid-cols-[max-content_1fr] ps-2 pe-0 rtl:grid-cols-[1fr_max-content] rtl:ps-0 rtl:pe-2",
          isOpponentBoard && isReversed && "grid-cols-1 ps-0 pe-1.5 rtl:grid-cols-1 rtl:ps-1.5 rtl:pe-0",
          isOpponentBoard && !isReversed && "grid-cols-1 ps-1.5 pe-0 rtl:grid-cols-1 rtl:ps-0 rtl:pe-1.5",
        )}
        dir={currentLanguage?.rtl ? "rtl" : "ltr"}
      >
        <div
          className={clsx(
            "w-player-board-username-empty-space-width",
            isOpponentBoard && "hidden",
            isReversed ? "order-2 rtl:order-1" : "order-1 rtl:order-2",
            "before:content-[' ']",
          )}
        />
        <div
          className={clsx(
            "flex items-center truncate",
            isOpponentBoard ? "gap-1 w-player-board-username-opponent-width" : "gap-2 w-player-board-username-width",
            isReversed ? "order-1 ms-1 me-0.5 rtl:order-2" : "order-2 ms-0.5 me-1 rtl:order-1",
          )}
        >
          {seat.occupiedByPlayerId && (
            <>
              <div className={clsx("shrink-0", isOpponentBoard ? "w-4 h-5" : "w-6 h-6")}>
                <AvatarCycler
                  userId={seat.occupiedByPlayer?.userId}
                  initialAvatarId={seat.occupiedByPlayer?.user.userSettings?.avatarId}
                  size={isOpponentBoard ? 16 : 24}
                />
              </div>
              <div
                className={clsx(
                  "truncate select-none cursor-pointer",
                  isOpponentBoard ? "text-sm" : "text-base",
                  board?.isHooDetected && "text-red-500 dark:text-red-400",
                )}
                title={t({ message: "Double-click to view player information" })}
                role="button"
                tabIndex={0}
                onDoubleClick={() =>
                  seat.occupiedByPlayer ? handleOpenPlayerInfoModal(seat.occupiedByPlayer) : undefined
                }
                onKeyDown={handlePlayerUsernameKeyDown}
              >
                {seat.occupiedByPlayer?.user.username}
              </div>
            </>
          )}
        </div>
      </div>
      <div
        className={clsx(
          "grid gap-2 w-full border-y-8 border-y-gray-300 bg-gray-300 select-none",
          isOpponentBoard
            ? "[grid-template-areas:'board-grid-container''board-grid-container']"
            : isReversed
              ? "[grid-template-areas:'board-grid-container_preview-piece''board-grid-container_power-bar']"
              : "[grid-template-areas:'preview-piece_board-grid-container''power-bar_board-grid-container']",
          isOpponentBoard ? "" : "grid-rows-[max-content_auto] grid-cols-[max-content_auto]",
          isReversed
            ? "border-s-2 border-s-gray-300 border-e-8 border-e-gray-300"
            : "border-s-8 border-s-gray-300 border-e-2 border-e-gray-300",
          "dark:border-s-slate-600 dark:border-e-slate-600 dark:border-y-slate-600 dark:bg-slate-600",
        )}
      >
        <div
          ref={(element: HTMLDivElement | null) => {
            if (isCurrentUserSeat) {
              boardRefs.current[seat.seatNumber - 1] = element;
            }
          }}
          className={clsx(
            "[grid-area:board-grid-container] relative grid w-full text-neutral-200",
            board?.isGameOver ? "bg-neutral-700 dark:bg-neutral-900" : "bg-neutral-100 dark:bg-slate-800",
            isOpponentBoard
              ? "grid-rows-(--grid-rows-grid-container-opponent) w-grid-container-opponent-width"
              : "grid-rows-(--grid-rows-grid-container) w-grid-container-width",
            "before:content-[attr(data-seat-number)] before:absolute before:start-1/2 before:-translate-x-1/2 before:text-[7rem] before:font-bold before:text-center",
            "dark:before:text-slate-700",
          )}
          tabIndex={0}
          data-seat-number={seatKeyLabel}
          data-testid="player-board_container_grid"
        >
          <div
            className={clsx(
              "absolute start-1/2 -translate-x-1/2 z-game-overlay flex flex-col gap-2 text-center",
              isOpponentBoard
                ? "top-[90%] -translate-y-[90%] w-full px-1 py-2"
                : "top-1/2 -translate-y-1/2 w-11/12 p-2",
              ((gameState === GameState.WAITING && isSitAccessGranted && (isSeatAvailable || isCurrentUserSeated)) ||
                isPlayerReady ||
                isPlayerWaitingForMorePlayers ||
                isPlayerWaitingForNextGame) &&
                "shadow-md bg-neutral-800 dark:border dark:border-slate-600 dark:bg-slate-700",
            )}
          >
            {gameState === GameState.WAITING && isSitAccessGranted && (
              <>
                {isSeatAvailable && (
                  <Button
                    className={clsx(
                      "w-full border-t-yellow-400 border-e-yellow-600 border-b-yellow-600 border-s-yellow-400",
                      "dark:border-t-yellow-600 dark:border-e-yellow-800 dark:border-b-yellow-800 dark:border-s-yellow-600",
                    )}
                    tabIndex={seat.seatNumber}
                    onClick={() => onSit(seat.seatNumber)}
                  >
                    <Trans>Join</Trans>
                  </Button>
                )}
                {isCurrentUserSeated && (
                  <>
                    <Button className="w-full" tabIndex={seat.seatNumber} onClick={onStand}>
                      <Trans>Stand</Trans>
                    </Button>
                    <Button
                      className={clsx(
                        "w-full border-t-yellow-400 border-e-yellow-600 border-b-yellow-600 border-s-yellow-400 bg-yellow-500 font-medium",
                        "dark:border-t-yellow-600 dark:border-e-yellow-800 dark:border-b-yellow-800 dark:border-s-yellow-600 dark:bg-yellow-600",
                      )}
                      tabIndex={seat.seatNumber}
                      onClick={onStartGame}
                    >
                      <Trans>Start</Trans>
                    </Button>
                  </>
                )}
              </>
            )}

            {(isPlayerReady || isPlayerWaitingForMorePlayers || isPlayerWaitingForNextGame) && (
              <p
                className={clsx(
                  "flex justify-center items-center text-neutral-50 overflow-hidden",
                  isOpponentBoard
                    ? "h-9 text-board-button-opponent leading-default"
                    : "h-16 text-board-button leading-default",
                )}
              >
                {isPlayerReady && <Trans>Ready</Trans>}
                {isPlayerWaitingForMorePlayers && <Trans>Waiting for more players</Trans>}
                {isPlayerWaitingForNextGame && <Trans>Waiting for the next game</Trans>}
              </p>
            )}
          </div>
          <Grid
            isOpponentBoard={isOpponentBoard}
            board={board}
            currentPiece={isCurrentUserSeat && isPlaying ? currentPiece : null}
            blocksToRemove={blocksToRemove}
          />
        </div>
        {!isOpponentBoard && (
          <>
            <div
              className={clsx(
                "[grid-area:preview-piece] flex flex-col items-center justify-center h-preview-piece-height px-2 py-2 bg-neutral-100",
                isOpponentBoard ? "" : "w-preview-piece-width",
                "dark:bg-slate-800",
              )}
            >
              {isCurrentUserSeat ? <NextPiece nextPiece={nextPieces?.nextPiece} /> : null}
            </div>
            <div
              className={clsx(
                "[grid-area:power-bar] flex flex-col items-center justify-end h-power-bar-height px-2 py-2 bg-neutral-100",
                isOpponentBoard ? "" : "w-power-bar-width",
                "dark:bg-slate-800",
              )}
              data-testid="player-board_container_power-bar"
            >
              <PowerBar powerBar={powerBar} />
            </div>
          </>
        )}
      </div>
    </div>
  );
});
