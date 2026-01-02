"use client";

import { KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { Socket } from "socket.io-client";
import { Avatar, AVATARS } from "@/constants/avatars";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useSocket } from "@/context/SocketContext";
import { useAvatarSave } from "@/hooks/useAvatarSave";

type AvatarCyclerProps = {
  userId?: string
  initialAvatarId?: string
  size?: number
  onAvatarChange?: (avatarId: string) => void
};

export function AvatarCycler({
  userId,
  initialAvatarId = AVATARS[0].id,
  size = 40,
  onAvatarChange,
}: AvatarCyclerProps): ReactNode {
  const { socketRef, isConnected, session } = useSocket();
  const { t } = useLingui();
  const { saveAvatarDebounced } = useAvatarSave();
  const [avatarId, setAvatarId] = useState<string | undefined>(initialAvatarId);

  const isCurrentUser: boolean = useMemo(() => userId === session?.user.id, [userId, session?.user.id]);

  const selected = useMemo(() => AVATARS.find((avatar: Avatar) => avatar.id === avatarId) ?? AVATARS[0], [avatarId]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const handleUpdateAvatar = ({ userId: updatedUserId, avatarId }: { userId: string; avatarId: string }): void => {
      if (updatedUserId === userId) {
        setAvatarId(avatarId);
      }
    };

    const attachListeners = (): void => {
      socket.on(ServerToClientEvents.USER_SETTINGS_AVATAR, handleUpdateAvatar);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.USER_SETTINGS_AVATAR, handleUpdateAvatar);
    };

    const onConnect = (): void => attachListeners();

    if (socket.connected) {
      onConnect();
    } else {
      socket.once("connect", onConnect);
    }

    return () => {
      socket.off("connect", onConnect);
      detachListeners();
    };
  }, [isConnected, userId]);

  const handleChangeAvatar = (): void => {
    const nextId: string = getNextId(avatarId);
    setAvatarId(nextId);
    onAvatarChange?.(nextId);
    saveAvatarDebounced(nextId);
  };

  return (
    <div className="inline-grid justify-items-center gap-1.5">
      <div
        className={clsx(
          "grid place-items-center p-0 overflow-hidden",
          isCurrentUser ? "cursor-pointer" : "cursor-default",
        )}
        style={{ width: size, height: size }}
        title={t({ message: "Double-click to change avatar" })}
        role="button"
        tabIndex={isCurrentUser ? 0 : -1}
        onDoubleClick={isCurrentUser ? handleChangeAvatar : undefined}
        onKeyDown={(event: KeyboardEvent) => {
          if (!isCurrentUser) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleChangeAvatar();
          }
        }}
      >
        <Image src={selected.src} className="rtl:-scale-x-100" width={size} height={size} alt={selected.description} />
      </div>
    </div>
  );
}

function getNextId(currentId: string | undefined): string {
  const idx: number = AVATARS.findIndex((avatar: Avatar) => avatar.id === currentId);
  const nextIdx: number = idx === -1 ? 0 : (idx + 1) % AVATARS.length;
  return AVATARS[nextIdx].id;
}
