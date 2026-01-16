import { ReactNode, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { Socket } from "socket.io-client";
import Timer from "@/components/game/table/Timer";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useSocket } from "@/context/SocketContext";
import { getReadableKeyLabel } from "@/lib/keyboard/get-readable-key-label";
import { PlayerControlKeysPlainObject } from "@/server/towers/classes/PlayerControlKeys";

type TableControlsAndTimerProps = {
  controlKeys: PlayerControlKeysPlainObject | null
};

export function TableControlsAndTimer({ controlKeys }: TableControlsAndTimerProps): ReactNode {
  const { socketRef, isConnected } = useSocket();
  const { i18n } = useLingui();
  const [timer, setTimer] = useState<number | null>(null);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const handleTimer = ({ timer }: { timer: number }): void => {
      setTimer(timer);
    };

    const attachListeners = (): void => {
      socket.on(ServerToClientEvents.GAME_TIMER_UPDATED, handleTimer);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.GAME_TIMER_UPDATED, handleTimer);
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
  );
}
