import next from "next";
import { createAdapter } from "@socket.io/redis-adapter";
import { createServer, Server as HttpServer } from "http";
import { Redis } from "ioredis";
import os from "os";
import { DisconnectReason, Socket, Server as SocketServer } from "socket.io";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { logger } from "@/lib/logger";
import { initRedisPublisher } from "@/server/redis/publish";
import { towersServerToClientEvents } from "@/server/towers/events/server-to-client";
import { RoomManager } from "@/server/towers/modules/room/room.manager";
import { TowersSocketHandler } from "@/server/towers/towers-socket.handler";
import { youpiServerToClientEvents } from "@/server/youpi/events/server-to-client";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserManager } from "@/server/youpi/modules/user/user.manager";
import { YoupiSocketHandler } from "@/server/youpi/youpi-socket.handler";

class AppServer {
  private readonly dev: boolean = process.env.NODE_ENV !== "production";
  private readonly protocol: string = process.env.PROTOCOL || "http";
  private readonly hostname: string = process.env.HOSTNAME || "localhost";
  private readonly port: number = parseInt(process.env.PORT || "3000", 10);
  private app = next({ dev: this.dev, hostname: this.hostname, port: this.port });
  private handler = this.app.getRequestHandler();
  private httpServer!: HttpServer;
  private io!: SocketServer;
  private redisPub!: Redis;
  private redisSub!: Redis;

  public async start(): Promise<void> {
    await this.app.prepare();
    await this.loadGameRooms();
    await this.setupRedis();
    this.setupIoServer();
    this.startHttpServer();
  }

  private async loadGameRooms(): Promise<void> {
    await RoomManager.findAll();
  }

  private async setupRedis(): Promise<void> {
    this.redisPub = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.redisSub = this.redisPub.duplicate();

    initRedisPublisher(this.redisPub);

    this.redisPub.on("ready", (): void => {
      logger.info("Redis connection successful.");
    });

    this.redisPub.on("error", (error: Error): void => {
      logger.error(`Redis connection error: ${error}`);
      process.exit(1);
    });

    process.on("SIGINT", async (): Promise<void> => {
      await this.redisPub.quit();
      await this.redisSub.quit();
      process.exit(0);
    });
  }

  private setupIoServer(): void {
    this.httpServer = createServer(this.handler);

    this.io = new SocketServer(this.httpServer, {
      adapter: createAdapter(this.redisPub, this.redisSub),
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true,
      },
      cors: {
        credentials: true,
        origin: process.env.TRUSTED_ORIGINS?.split(",") || [],
      },
    });

    towersServerToClientEvents(this.redisSub, this.io);
    youpiServerToClientEvents(this.redisSub, this.io);

    this.io.use((socket, next) => {
      const session = socket.handshake.auth.session;

      if (!session?.user) {
        logger.warn(`Socket ${socket.id} has no valid session during connect. Allowing connection for recovery.`);
        return next();
      }

      socket.data.session = session;
      next();
    });

    this.io.on("connection", this.handleConnection.bind(this));

    // Debug room lifecycle
    this.io.of("/").adapter.on("create-room", (room: string) => logger.info(`Room ${room} created`));
    this.io.of("/").adapter.on("join-room", (room: string, id: string) => logger.info(`Socket ${id} joined ${room}`));
    this.io.of("/").adapter.on("leave-room", (room: string, id: string) => logger.info(`Socket ${id} left ${room}`));
    this.io.of("/").adapter.on("delete-room", (room: string) => logger.info(`Room ${room} deleted`));
  }

  private async handleConnection(socket: Socket): Promise<void> {
    const { user: sessionUser } = socket.data.session;

    if (!sessionUser) {
      logger.warn("Connection attempt without valid session");
      socket.disconnect(true);
      return;
    }

    const user: User | null = await UserManager.findById(sessionUser.id);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    await UserManager.attachSocket(this.io, user.id, socket);
    logger.info(`Socket connected: ${socket.id} for ${user.username} (${user.id})`);

    // **************************************************
    // * Socket Recovery
    // **************************************************

    if (socket.recovered) {
      logger.debug("Client recovered session successfully");
      // Optional: re-join rooms or restore game/table state
      // You may store previously joined room/table info in Redis manually
      // and recover it here, re-calling .join(roomId)
    } else {
      // First connection, or too late to recover
      // Normal user setup
      logger.debug("First connection, or too late to recover");
    }

    // **************************************************
    // * Socket IO Events
    // **************************************************

    socket.conn.on("upgrade", (transport): void => {
      logger.info(`Transport upgraded to ${transport.name}`);
    });

    socket.conn.on("close", (reason: string): void => {
      logger.info(`Socket ${socket.id} connection closed due to ${reason}.`);
    });

    socket.on("disconnecting", (reason: DisconnectReason) => {
      logger.info(`Socket ${socket.id} disconnecting due to ${reason}.`);
    });

    socket.on("disconnect", (reason: DisconnectReason): void => {
      logger.info(`Socket ${socket.id} disconnected due to ${reason}.`);
    });

    socket.on("error", (error: Error): void => {
      logger.error(`Socket error: ${error.message}`);
    });

    socket.on(ClientToServerEvents.SIGN_OUT, async (): Promise<void> => {
      await RoomManager.leaveAllRoomsForUser(user, socket);
      socket.emit(ServerToClientEvents.SIGN_OUT_SUCCESS);
      socket.disconnect(true);
    });

    // **************************************************
    // * Other Events
    // **************************************************

    const youpiHandler: YoupiSocketHandler = new YoupiSocketHandler(this.io, socket, user);
    youpiHandler.registerSocketListeners();

    const towersHandler: TowersSocketHandler = new TowersSocketHandler(this.io, socket, user);
    towersHandler.registerSocketListeners();
  }

  private startHttpServer(): void {
    this.httpServer
      .once("error", (error: Error) => {
        logger.error(`Server error: ${error}`);
        process.exit(1);
      })
      .listen(this.port, () => {
        const localIp: string = this.getLocalIpAddress();

        logger.info(`🌍 Ready at ${this.protocol}://${this.hostname}:${this.port}`);
        logger.debug(`🏠 Local access: ${this.protocol}://${localIp}:${this.port}`);

        // this.runScheduler()
      });
  }

  private getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "localhost";
  }

  // private async runScheduler(): Promise<void> {
  //   try {
  //     await axios.post(
  //       `${process.env.BASE_URL}/api/services/scheduler`,
  //       {
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     )
  //   } catch (error) {
  //     logger.error(error)
  //   }
  // }
}

const server: AppServer = new AppServer();
server.start();
