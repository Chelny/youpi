import { useRef } from "react";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";

type AvatarDebounceOptions = {
  onStart?: () => void
  onSuccess?: () => void
  onError?: (message?: string) => void
};

interface AvatarSave {
  saveAvatarDebounced: (avatarId: string, options?: AvatarDebounceOptions) => void
}

export function useAvatarSave(): AvatarSave {
  const tRef = useRef<number | null>(null);
  const { socketRef, session, setUserAvatar } = useSocket();

  const saveAvatarDebounced = (avatarId: string, options?: AvatarDebounceOptions): void => {
    const userId: string | undefined = session?.user?.id;
    if (!userId) return;

    setUserAvatar(userId, avatarId);
    options?.onStart?.();

    if (tRef.current) window.clearTimeout(tRef.current);

    tRef.current = window.setTimeout(() => {
      socketRef.current?.emit(
        ClientToServerEvents.USER_SETTINGS_AVATAR,
        { avatarId },
        (response: SocketCallback): void => {
          if (response.success) {
            options?.onSuccess?.();
          } else {
            options?.onError?.(response?.message);
          }
        },
      );
    }, 300);
  };

  return { saveAvatarDebounced };
}
