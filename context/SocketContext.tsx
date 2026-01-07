"use client";

import {
  Context,
  createContext,
  PropsWithChildren,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { ROUTE_HOME } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { Session } from "@/lib/auth-client";
import { logger } from "@/lib/logger";

type UserAvatarsMap = Record<string, string>;

interface SocketContextType {
  socketRef: RefObject<Socket | null>
  isConnected: boolean
  session: Session | null
  userAvatars: UserAvatarsMap
  setUserAvatar: (userId: string, avatarId: string) => void
}

export const SocketContext: Context<SocketContextType | undefined> = createContext<SocketContextType | undefined>(
  undefined,
);

export const SocketProvider = ({ children, session }: PropsWithChildren<{ session: Session | null }>): ReactNode => {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [userAvatars, setUserAvatars] = useState<UserAvatarsMap>({});

  useEffect(() => {
    if (!session) {
      if (socketRef.current) {
        // TODO: Show a modal or redirect user to sign in page
        logger.warn("No session found. Disconnecting socket and prompting user to re-auth.");
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      return;
    }

    if (socketRef.current) {
      logger.info("Socket already exists. No new connection.");
      return;
    }

    // Session is ready, socket will be created
    const socket: Socket = io({
      auth: { session },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 10000,
      reconnectionDelayMax: 10000,
      withCredentials: true,
    });

    socketRef.current = socket;

    // **************************************************
    // * Socket IO Events
    // **************************************************

    socket.on("connect", () => {
      setIsConnected(true);
      logger.info(`Socket connected. Socket ID: ${socket.id}.`);
    });

    socket.on("connect_error", (error: Error) => {
      logger.error(`Socket connection error: ${error.message}.`);
    });

    socket.on("reconnect", (attempt: number) => {
      logger.info(`Reconnected to the socket successfully after ${attempt} attempts.`);
    });

    socket.on("reconnect_attempt", (attempt: number) => {
      logger.info(`Attempting to reconnect to the socket... Attempt number: ${attempt}.`);

      // Re-attach the session on every reconnect attempt
      socket.auth = { session };
    });

    socket.on("reconnect_error", (error: Error) => {
      logger.error(`Socket reconnection error: ${error.message}.`);
    });

    socket.on("reconnect_failed", () => {
      logger.error("Socket reconnection failed.");
    });

    socket.on("disconnect", (reason: string) => {
      setIsConnected(false);
      logger.info(`Socket disconnected due to ${reason}.`);
    });

    socket.on("error", (error: Error) => {
      logger.error(`Socket error: ${error.message}.`);
    });

    socket.on(ServerToClientEvents.SIGN_OUT_SUCCESS, () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      router.push(ROUTE_HOME.PATH);
    });

    // **************************************************
    // * Server Error Events
    // **************************************************

    socket.on(ServerToClientEvents.SERVER_ERROR, (message: string) => {
      logger.error(`Server error: ${message}.`);
    });

    // **************************************************
    // * Network Events
    // **************************************************

    const handleOnline = (): void => {
      logger.info("You are online. Reconnecting socket...");
      socket.connect();
    };

    const handleOffline = (): void => {
      logger.warn("You are offline. Disconnecting socket...");
      socket.disconnect();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // **************************************************
    // * Cleanups
    // **************************************************

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;

      socket.off("connect");
      socket.off("connect_error");
      socket.off("reconnect");
      socket.off("reconnect_attempt");
      socket.off("reconnect_error");
      socket.off("reconnect_failed");
      socket.off("disconnect");
      socket.off("error");
      socket.off(ServerToClientEvents.SIGN_OUT_SUCCESS);
      socket.off(ServerToClientEvents.SERVER_ERROR);

      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [session?.user.id]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const handleUserOnline = (): void => {
      socket.emit(ClientToServerEvents.USER_CONNECTED);
    };

    const handleUserOffline = (): void => {
      socket.emit(ClientToServerEvents.USER_DISCONNECTED);
    };

    const handlePingEcho = (_: unknown, callback: (response: boolean) => void): void => {
      callback(true);
    };

    const handleAvatarUpdate = ({ userId, avatarId }: { userId: string; avatarId: string }): void => {
      setUserAvatar(userId, avatarId);
    };

    socket.on(ServerToClientEvents.USER_ONLINE, handleUserOnline);
    socket.on(ServerToClientEvents.USER_OFFLINE, handleUserOffline);
    socket.on(ServerToClientEvents.PING_ECHO, handlePingEcho);
    socket.on(ServerToClientEvents.USER_SETTINGS_AVATAR, handleAvatarUpdate);

    return () => {
      socket.off(ServerToClientEvents.USER_ONLINE, handleUserOnline);
      socket.off(ServerToClientEvents.USER_OFFLINE, handleUserOffline);
      socket.off(ServerToClientEvents.PING_ECHO, handlePingEcho);
      socket.off(ServerToClientEvents.USER_SETTINGS_AVATAR, handleAvatarUpdate);
    };
  }, [isConnected, session?.user.id]);

  useEffect(() => {
    const myId: string | undefined = session?.user?.id;
    const myAvatarId: string | undefined = session?.user?.userSettings?.avatarId;
    if (!myId || !myAvatarId) return;
    setUserAvatar(myId, myAvatarId);
  }, [session?.user?.id, session?.user?.userSettings?.avatarId]);

  const setUserAvatar = (userId: string, avatarId: string): void => {
    setUserAvatars((prev: UserAvatarsMap) => {
      if (prev[userId] === avatarId) return prev;
      return { ...prev, [userId]: avatarId };
    });
  };

  return (
    <SocketContext.Provider value={{ socketRef, isConnected, session, userAvatars, setUserAvatar }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context: SocketContextType | undefined = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within a SocketProvider");
  return context;
};
