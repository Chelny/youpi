import { User as UserModel, UserSettings as UserSettingsModel } from "db/client";
import { Server as IoServer, Socket } from "socket.io";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { logger } from "@/lib/logger";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserFactory } from "@/server/youpi/modules/user/user.factory";
import { UserService } from "@/server/youpi/modules/user/user.service";

export class UserManager {
  private static cache: Map<string, User> = new Map<string, User>();
  private static socketIdsByUserId: Map<string, Set<string>> = new Map<string, Set<string>>();

  public static async findById(id: string): Promise<User> {
    const cached: User | undefined = this.cache.get(id);
    if (cached) return cached;

    const dbUser: (UserModel & { userSettings: UserSettingsModel | null }) | null = await UserService.findById(id);
    if (!dbUser) throw new Error(`User ${id} not found`);

    const user: User = UserFactory.createUser(dbUser);
    this.cache.set(user.id, user);

    return user;
  }

  public static async blockTableInvitations(userId: string): Promise<void> {
    const user: User = await this.findById(userId);
    user.blockTableInvitations();
    logger.debug(`${user.username} blocked invitations.`);
  }

  public static async allowTableInvitations(userId: string): Promise<void> {
    const user: User = await this.findById(userId);
    user.allowTableInvitations();
    logger.debug(`${user.username} allow invitations.`);
  }

  public static delete(id: string): void {
    this.cache.delete(id);
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
