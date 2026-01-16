import { ReactNode, useEffect, useState } from "react";
import { Plural, Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { GameState } from "db/enums";
import { Socket } from "socket.io-client";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useSocket } from "@/context/SocketContext";
import { TablePlayerPlainObject } from "@/server/towers/classes/TablePlayer";

type TableGameOverOverlayProps = {
  gameState: GameState
};

export function TableGameOverOverlay({ gameState }: TableGameOverOverlayProps): ReactNode {
  const { socketRef, isConnected } = useSocket();
  const [winnersCount, setWinnersCount] = useState<number>(0);
  const [firstWinner, setFirstWinner] = useState<string | undefined>(undefined);
  const [secondWinner, setSecondWinner] = useState<string | undefined>(undefined);
  const [isWinner, setIsWinner] = useState<boolean>(false);
  const [isPlayedThisRound, setIsPlayedThisRound] = useState<boolean>(false);
  const [gameOverAnimationClass, setGameOverAnimationClass] = useState("animate-move-up");

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
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

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
      socket.on(ServerToClientEvents.GAME_OVER, handleGameOver);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.GAME_OVER, handleGameOver);
    };

    const onConnect = (): void => {
      attachListeners();
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
  }, [isConnected]);

  return (
    <>
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
    </>
  );
}
