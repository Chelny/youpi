import { User as UserModel, UserSettings as UserSettingsModel } from "db/client";
import { Server as IoServer, Socket } from "socket.io";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { logger } from "@/lib/logger";
import { User, UserProps } from "@/server/youpi/classes/User";
import { UserSettings } from "@/server/youpi/classes/UserSettings";
import { UserService } from "@/server/youpi/services/UserService";

export class UserManager {
  private static users: Map<string, User> = new Map<string, User>();
  private static socketIdsByUserId: Map<string, Set<string>> = new Map<string, Set<string>>();

  // ---------- Database Load ------------------------------

  public static async loadUserFromDb(id: string): Promise<User> {
    const db: (UserModel & { userSettings: UserSettingsModel | null }) | null = await UserService.getUserById(id);
    if (!db) throw new Error(`User ${id} not found`);
    return this.upsert(db);
  }

  // ---------- Basic CRUD ---------------------------------

  public static get(id: string): User | undefined {
    return this.users.get(id);
  }

  public static all(): User[] {
    return [...this.users.values()];
  }

  public static create(props: UserProps): User {
    let user: User | undefined = this.users.get(props.id);
    if (user) return user;

    user = new User(props);
    this.users.set(user.id, user);

    return user;
  }

  public static upsert(props: UserProps): User {
    const user: User | undefined = this.users.get(props.id);

    if (user) {
      user.username = props.username;
      user.userSettings = props.userSettings
        ? new UserSettings({
            id: props.userSettings.id,
            avatarId: props.userSettings.avatarId,
            theme: props.userSettings.theme,
            profanityFilter: props.userSettings.profanityFilter,
          })
        : null;

      return user;
    }

    return this.create(props);
  }

  public static delete(id: string): void {
    this.users.delete(id);
  }

  // ---------- User Actions --------------------------------

  public static blockTableInvitations(userId: string): void {
    const user: User | undefined = this.get(userId);

    if (user) {
      user.blockTableInvitations();
      logger.debug(`${user.username} blocked invitations.`);
    }
  }

  public static allowTableInvitations(userId: string): void {
    const user: User | undefined = this.get(userId);

    if (user) {
      user.allowTableInvitations();
      logger.debug(`${user.username} allow invitations.`);
    }
  }

  // ---------- Socket Actions ------------------------------

  public static async attachSocket(io: IoServer, userId: string, socket: Socket): Promise<void> {
    let set: Set<string> | undefined = this.socketIdsByUserId.get(userId);

    if (!set) {
      set = new Set<string>();
      this.socketIdsByUserId.set(userId, set);
    }

    const wasOffline: boolean = set.size === 0;

    set.add(socket.id);
    await socket.join(userId);

    if (wasOffline) {
      io.emit(ServerToClientEvents.USER_ONLINE, { userId });
    }

    socket.once("disconnect", () => {
      this.detachSocket(io, userId, socket.id);
    });
  }

  private static detachSocket(io: IoServer, userId: string, socketId: string): void {
    const set: Set<string> | undefined = this.socketIdsByUserId.get(userId);
    if (!set) return;

    set.delete(socketId);

    if (set.size === 0) {
      this.socketIdsByUserId.delete(userId);
      io.emit(ServerToClientEvents.USER_OFFLINE, { userId });
    }
  }

  public static getAnySocket(io: IoServer, userId: string): Socket | null {
    const set: Set<string> | undefined = this.socketIdsByUserId.get(userId);
    if (!set || set.size === 0) return null;

    const firstId: string = set.values().next().value as string;
    return io.sockets.sockets.get(firstId) ?? null;
  }

  public static emitTo(io: IoServer, userId: string, event: string, payload: unknown): void {
    io.to(userId).emit(event, payload);
  }
}
