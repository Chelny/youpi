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
        // TODO: Show a modal (prompting user to re-auth?) or redirect user to sign in page
        logger.warn("No session found. Disconnecting socket.");
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

    const handleConnect = (): void => {
      setIsConnected(true);
      logger.info(`Socket connected. Socket ID: ${socket.id}.`);
    };

    const handleConnectError = (error: Error): void => {
      logger.error(`Socket connection error: ${error.message}.`);
    };

    const handleReconnect = (attempt: number): void => {
      logger.info(`Reconnected after ${attempt} attempts.`);
    };

    const handleReconnectAttempt = (attempt: number): void => {
      logger.info(`Reconnect attempt #${attempt}`);
      socket.auth = { session };
    };

    const handleReconnectError = (error: Error): void => {
      logger.error(`Socket reconnection error: ${error.message}.`);
    };

    const handleReconnectFailed = (): void => {
      logger.error("Socket reconnection failed.");
    };

    const handleDisconnect = (reason: string): void => {
      setIsConnected(false);
      logger.info(`Socket disconnected due to ${reason}.`);
    };

    const handleError = (error: Error): void => {
      logger.error(`Socket error: ${error.message}.`);
    };

    const handleSignOutSuccess = (): void => {
      socket.disconnect();
      socketRef.current = null;
      router.push(ROUTE_HOME.PATH);
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("reconnect", handleReconnect);
    socket.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("reconnect_error", handleReconnectError);
    socket.on("reconnect_failed", handleReconnectFailed);
    socket.on("disconnect", handleDisconnect);
    socket.on("error", handleError);
    socket.on(ServerToClientEvents.SIGN_OUT_SUCCESS, handleSignOutSuccess);

    // **************************************************
    // * Server Error Events
    // **************************************************

    const handleServerError = (message: string): void => {
      logger.error(`Server error: ${message}.`);
    };

    socket.on(ServerToClientEvents.SERVER_ERROR, handleServerError);

    // **************************************************
    // * Network Events
    // **************************************************

    const handleUserOnline = ({ userId }: { userId: string }): void => {
      logger.info(`${userId} is online`);
    };

    const handleUserOffline = ({ userId }: { userId: string }): void => {
      logger.info(`${userId} is offline`);
    };

    socket.on(ServerToClientEvents.USER_ONLINE, handleUserOnline);
    socket.on(ServerToClientEvents.USER_OFFLINE, handleUserOffline);

    // **************************************************
    // * Cleanups
    // **************************************************

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("reconnect", handleReconnect);
      socket.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("reconnect_error", handleReconnectError);
      socket.off("reconnect_failed", handleReconnectFailed);
      socket.off("disconnect", handleDisconnect);
      socket.off("error", handleError);

      socket.off(ServerToClientEvents.SIGN_OUT_SUCCESS, handleSignOutSuccess);
      socket.off(ServerToClientEvents.SERVER_ERROR, handleServerError);

      socket.off(ServerToClientEvents.USER_ONLINE, handleUserOnline);
      socket.off(ServerToClientEvents.USER_OFFLINE, handleUserOffline);
    };
  }, [session]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const handlePingEcho = (_: unknown, callback: (response: boolean) => void): void => {
      callback(true);
    };

    const handleAvatarUpdate = ({ userId, avatarId }: { userId: string; avatarId: string }): void => {
      setUserAvatar(userId, avatarId);
    };

    socket.on(ServerToClientEvents.PING_ECHO, handlePingEcho);
    socket.on(ServerToClientEvents.USER_SETTINGS_AVATAR, handleAvatarUpdate);

    return () => {
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
