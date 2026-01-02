"use client";

import { InputEvent, ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { Duration, formatDuration, intervalToDuration } from "date-fns";
import { Socket } from "socket.io-client";
import ConversationsModal from "@/components/ConversationsModal";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useModal } from "@/context/ModalContext";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { PlayerPlainObject } from "@/server/towers/classes/Player";
import { getDateFnsLocale } from "@/translations/languages";

type PlayerInformationModalProps = {
  roomId: string
  selectedPlayer?: PlayerPlainObject
  isRatingsVisible?: boolean | null
  onCancel: () => void
};

export default function PlayerInformationModal({
  roomId,
  selectedPlayer,
  isRatingsVisible = false,
  onCancel,
}: PlayerInformationModalProps): ReactNode {
  const { socketRef, isConnected, session } = useSocket();
  const { i18n, t } = useLingui();
  const router = useRouter();
  const { openModal } = useModal();
  const [isCurrentUser, setIsCurrentUser] = useState<boolean>(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [targetNetDelay, setTargetNetDelay] = useState<number | null>(null);
  const [myNetDelay, setMyNetDelay] = useState<number | null>(null);
  const [watchUserAtTable, setWatchUserAtTable] = useState<string | null>(null);
  const [idleTime, setIdleTime] = useState<string | undefined>(undefined);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const username: string | null | undefined = selectedPlayer?.user.username;
  const rating: number | undefined = selectedPlayer?.stats.rating;
  const gamesCompleted: number | undefined = selectedPlayer?.stats.gamesCompleted;
  const wins: number | undefined = selectedPlayer?.stats.wins;
  const losses: number | undefined = selectedPlayer?.stats.losses;
  const streak: number | undefined = selectedPlayer?.stats.streak;

  useEffect(() => {
    if (!selectedPlayer?.id || !session?.user?.id) return;

    setIsCurrentUser(selectedPlayer?.id === session?.user?.id);

    if (isCurrentUser) return;

    socketRef.current?.emit(
      ClientToServerEvents.GAME_WATCH_USER_AT_TABLE,
      { roomId, userId: selectedPlayer?.id },
      (response: SocketCallback<{ roomId: string; tableId: string }>) => {
        if (response.success) {
          setWatchUserAtTable(`${ROUTE_TOWERS.PATH}?room=${response?.data?.roomId}&table=${response?.data?.tableId}`);
        } else {
          setWatchUserAtTable(null);
        }
      },
    );
  }, [selectedPlayer?.id, session?.user?.id]);

  useEffect(() => {
    if (!selectedPlayer?.lastActiveAt) return;

    const lastActiveAt: Date = new Date(selectedPlayer.lastActiveAt);
    const duration: Duration = intervalToDuration({ start: lastActiveAt, end: new Date() });
    const formattedIdleTime: string = formatDuration(duration, {
      locale: getDateFnsLocale(i18n.locale),
      format: ["hours", "minutes", "seconds"],
    });

    setIdleTime(formattedIdleTime);
  }, [selectedPlayer?.lastActiveAt]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const emitInitialData = (): void => {
      socket.emit(
        ClientToServerEvents.USER_RELATIONSHIP_MUTE_CHECK,
        { mutedUserId: selectedPlayer?.id },
        (response: SocketCallback<boolean>) => {
          if (response.success && typeof response.data !== "undefined") {
            setIsMuted(response.data);
          }
        },
      );
    };

    const handleMuteUser = (): void => {
      setIsMuted(true);
    };

    const handleUnmuteUser = (): void => {
      setIsMuted(false);
    };

    const attachListeners = (): void => {
      socket.on(ServerToClientEvents.USER_RELATIONSHIP_MUTE, handleMuteUser);
      socket.on(ServerToClientEvents.USER_RELATIONSHIP_UNMUTE, handleUnmuteUser);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.USER_RELATIONSHIP_MUTE, handleMuteUser);
      socket.off(ServerToClientEvents.USER_RELATIONSHIP_UNMUTE, handleUnmuteUser);
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
  }, [isConnected, selectedPlayer?.id]);

  const handleSendMessage = (): void => {
    socketRef.current?.emit(
      ClientToServerEvents.CONVERSATION_MESSAGE_SEND,
      { recipientId: selectedPlayer?.id, message },
      (response: SocketCallback<string>) => {
        if (response.success && response.data) {
          onCancel?.();
          openModal(ConversationsModal, { conversationId: response.data });
        }
      },
    );
  };

  const handleToggleMuteUser = (): void => {
    if (isMuted) {
      socketRef.current?.emit(ClientToServerEvents.USER_RELATIONSHIP_UNMUTE, { mutedUserId: selectedPlayer?.id });
    } else {
      socketRef.current?.emit(ClientToServerEvents.USER_RELATIONSHIP_MUTE, { mutedUserId: selectedPlayer?.id });
    }
  };

  const handleWatch = (): void => {
    if (watchUserAtTable) {
      router.push(watchUserAtTable);
    }

    onCancel?.();
  };

  const handlePing = (): void => {
    if (!selectedPlayer?.id) return;

    const startTime: number = Date.now();

    socketRef.current?.emit(
      ClientToServerEvents.PING_REQUEST,
      { userId: selectedPlayer?.id },
      (response: SocketCallback<{ roundTrip?: number }>) => {
        if (response.success) {
          const myDelayMs: number = Date.now() - startTime;
          const targetDelayMs: number = response.data?.roundTrip ?? 0;

          // Convert to seconds
          const myDelaySeconds: number = Number((myDelayMs / 1000).toFixed(2));
          const targetDelaySeconds: number = Number((targetDelayMs / 1000).toFixed(2));

          setMyNetDelay(myDelaySeconds);
          setTargetNetDelay(targetDelaySeconds);
        }
      },
    );
  };

  return (
    <Modal
      title={t({ message: `Player information of ${username}` })}
      cancelText={t({ message: "Close" })}
      dataTestId="player-information"
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-2">
        {isRatingsVisible && (
          <div>
            {t({ message: `Rating: ${rating}` })} <br />
            {t({ message: `Games Completed: ${gamesCompleted}` })} <br />
            {t({ message: `Wins: ${wins}` })} <br />
            {t({ message: `Losses: ${losses}` })} <br />
            {t({ message: `Streak: ${streak}` })} <br />
          </div>
        )}
        {!isCurrentUser && (
          <Input
            id="instantMessage"
            label={t({ message: "Send instant message" })}
            defaultValue={message}
            inlineButtonText={t({ message: "Send" })}
            onInput={(event: InputEvent<HTMLInputElement>) => setMessage(event.currentTarget.value)}
            onInlineButtonClick={handleSendMessage}
          />
        )}
        <div>
          {idleTime ? (
            t({ message: `Idle time: ${idleTime}.` })
          ) : (
            <Trans>
              Idle time: <i className="text-neutral-500 dark:text-dark-text-muted">unavailable</i>
            </Trans>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {!isCurrentUser && (
            <div className="flex items-center gap-2">
              <div className="w-fit">
                <Button
                  className="w-auto whitespace-nowrap"
                  dataTestId="player-information_button_ping"
                  onClick={handlePing}
                >
                  {t({ message: "Ping" })}
                </Button>
              </div>
              {targetNetDelay !== null && myNetDelay !== null && (
                <div className="text-sm">
                  <Plural
                    value={targetNetDelay}
                    zero={`${username}’s net delay: ${targetNetDelay} seconds.`}
                    one={`${username}’s net delay: ${targetNetDelay} second.`}
                    other={`${username}’s net delay: ${targetNetDelay} seconds.`}
                  />
                  <br />
                  <Plural
                    value={myNetDelay}
                    zero={`My net delay: ${myNetDelay} seconds.`}
                    one={`My net delay: ${myNetDelay} second.`}
                    other={`My net delay: ${myNetDelay} seconds.`}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-between items-center">
          {!isCurrentUser && (
            <div className="w-fit -mb-4">
              <Checkbox
                id="muteUser"
                label={t({ message: "Ignore" })}
                defaultChecked={isMuted}
                onChange={handleToggleMuteUser}
              />
            </div>
          )}
          {watchUserAtTable && (
            <Button className="w-fit" dataTestId="player-information_button_watch" onClick={handleWatch}>
              {t({ message: "Watch" })}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
