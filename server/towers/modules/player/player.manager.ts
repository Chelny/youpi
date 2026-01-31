import { Player, PlayerProps } from "@/server/towers/modules/player/player.entity";
import { PlayerService } from "@/server/towers/modules/player/player.service";
import { PlayerControlKeysManager } from "@/server/towers/modules/player-control-keys/player-control-keys.manager";
import { PlayerStatsManager } from "@/server/towers/modules/player-stats/player-stats.manager";
import { UserManager } from "@/server/youpi/modules/user/user.manager";
import { TowersPlayerLite } from "@/types/prisma";

export class PlayerManager {
  private static players: Map<string, Player> = new Map<string, Player>();

  // ---------- Database Load ------------------------------

  public static async loadPlayerFromDb(id: string): Promise<Player> {
    const db: TowersPlayerLite = await PlayerService.getPlayerById(id);
    if (!db.controlKeys) throw new Error("ControlKeys missing for new TowersPlayer");
    if (!db.stats) throw new Error("Stats missing for new TowersPlayer");

    const winHistory: Date[] | null = Array.isArray(db.stats.winHistory)
      ? (db.stats.winHistory as unknown[])
          .filter(
            (v: unknown): v is string | number | Date =>
              typeof v === "string" || typeof v === "number" || v instanceof Date,
          )
          .map((v: string | number | Date) => new Date(v))
      : null;

    const props: PlayerProps = {
      id: db.id,
      user: UserManager.upsert(db.user),
      controlKeys: await PlayerControlKeysManager.upsert(db.controlKeys),
      stats: PlayerStatsManager.upsert({ ...db.stats, winHistory }),
    };

    return this.upsert(props);
  }

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): Player | undefined {
    return this.players.get(id);
  }

  public static all(): Player[] {
    return [...this.players.values()];
  }

  public static create(props: PlayerProps): Player {
    let player: Player | undefined = this.players.get(props.id);
    if (player) return player;

    player = new Player(props);
    this.players.set(player.id, player);

    return player;
  }

  public static upsert(props: PlayerProps): Player {
    const player: Player | undefined = this.players.get(props.id);

    if (player) {
      player.user = props.user;
      player.controlKeys = props.controlKeys;
      player.stats = props.stats;
      player.lastActiveAt = new Date();
      return player;
    }

    return this.create(props);
  }

  public static delete(id: string): void {
    this.players.delete(id);
  }

  // ---------- Player Actions ------------------------------

  public static updateLastActiveAt(playerId: string): void {
    const player: Player | undefined = this.all().find((p: Player) => p.id === playerId);
    if (!player) return;
    player.updateLastActiveAt();
  }
}
