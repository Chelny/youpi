import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { PlayerService } from "@/server/towers/modules/player/player.service";
import { TowersPlayerLite } from "@/types/prisma";

export class PlayerManager {
  private static cache: Map<string, Player> = new Map<string, Player>();

  public static async findById(id: string): Promise<Player> {
    const cached: Player | undefined = this.cache.get(id);
    if (cached) return cached;

    const dbPlayer: TowersPlayerLite = await PlayerService.findById(id);
    const player: Player = PlayerFactory.createPlayer(dbPlayer);
    this.cache.set(player.id, player);

    return player;
  }

  public static async create(userId: string): Promise<Player> {
    const dbPlayer: TowersPlayerLite = await PlayerService.create(userId);
    const player: Player = PlayerFactory.createPlayer(dbPlayer);
    this.cache.set(player.id, player);
    return player;
  }

  public static async updateLastActiveAt(id: string): Promise<Player> {
    const dbPlayer: TowersPlayerLite = await PlayerService.updateLastActiveAt(id);
    const player: Player = PlayerFactory.createPlayer(dbPlayer);

    player.updateLastActiveAt();
    this.cache.set(player.id, player);

    return player;
  }

  public static delete(id: string): void {
    this.cache.delete(id);
  }
}
