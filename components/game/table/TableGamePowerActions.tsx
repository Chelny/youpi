import { ReactNode, useEffect, useRef, useState } from "react";
import { Plural, Select, Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { Socket } from "socket.io-client";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useSocket } from "@/context/SocketContext";
import { SocketListener } from "@/lib/socket/socket-listener";
import { PowerBarItemPlainObject } from "@/server/towers/game/power-bar";
import { TablePlayerPlainObject } from "@/server/towers/modules/table-player/table-player.entity";

type TableGamePowerActionsProps = {
  tableId: string
  seatNumber: number | null
  nextPowerBarItem: PowerBarItemPlainObject | undefined
};

export function TableGamePowerActions({
  tableId,
  seatNumber,
  nextPowerBarItem,
}: TableGamePowerActionsProps): ReactNode {
  const { socketRef, isConnected, session } = useSocket();
  const seatNumberRef = useRef<number | null>(null);
  const [usedPowerItem, setUsedPowerItem] = useState<
    { powerItem: PowerBarItemPlainObject; sourceUsername: string; targetUsername: string } | undefined
  >(undefined);
  const [usedPowerItemTextOpacity, setUsedPowerItemTextOpacity] = useState<number>(1);

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
          <Select
            value={powerLevel}
            _minor="You can minorly dither"
            _mega="You can mega dither"
            other="You can dither"
          />
        );
      } else if (letter === "U") {
        return (
          <Select
            value={powerLevel}
            _minor="You can add a stone"
            _normal="You can add 2 stones"
            _mega="You can add 3 stones"
            other="You can add stones"
          />
        );
      } else if (letter === "P") {
        return (
          <Select
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
          <Select
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
          <Select value={powerLevel} _minor="You can minorly clump" _mega="You can mega clump" other="You can clump" />
        );
      } else if (letter === "U") {
        return (
          <Select
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
          <Select
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
          <Select
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

  useEffect(() => {
    seatNumberRef.current = seatNumber;
  }, [seatNumber]);

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

    const socketListener: SocketListener = new SocketListener(socket);

    const handlePowerFire = ({
      powerItem,
      source,
      target,
    }: {
      powerItem: PowerBarItemPlainObject
      source: TablePlayerPlainObject
      target: TablePlayerPlainObject
    }): void => {
      const mySeatNumber: number | null = seatNumberRef.current;

      if (mySeatNumber === target.seatNumber && target.playerId === session?.user.id) {
        socket.emit(ClientToServerEvents.GAME_POWER_APPLY, { tableId, powerItem, source, target });
      }

      setUsedPowerItem({
        powerItem,
        sourceUsername: source.player.user.username,
        targetUsername: target.player.user.username,
      });
    };

    const attachListeners = (): void => {
      socketListener.on(ServerToClientEvents.GAME_POWER_USE, handlePowerFire);
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
  }, [isConnected, tableId]);

  return (
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
        className={clsx("w-full min-h-5 text-gray-500 truncate", "dark:text-dark-text-muted")}
        style={{ opacity: usedPowerItemTextOpacity }}
      >
        {renderUsedPowerItemText(usedPowerItem)}
      </span>
    </div>
  );
}
