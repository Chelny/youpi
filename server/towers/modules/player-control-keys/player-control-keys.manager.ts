import { TowersPlayerControlKeys } from "db/client";
import { TowersPlayerControlKeysUpdateInput } from "db/models";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { PlayerControlKeys } from "@/server/towers/modules/player-control-keys/player-control-keys.entity";
import { PlayerControlKeysFactory } from "@/server/towers/modules/player-control-keys/player-control-keys.factory";
import { PlayerControlKeysService } from "@/server/towers/modules/player-control-keys/player-control-keys.service";

export class PlayerControlKeysManager {
  private static cache: Map<string, PlayerControlKeys> = new Map<string, PlayerControlKeys>();

  public static async findByPlayerId(playerId: string): Promise<PlayerControlKeys> {
    const cached: PlayerControlKeys | undefined = this.cache.get(playerId);
    if (cached) return cached;

    let dbPlayerControlKeys: TowersPlayerControlKeys | null = await PlayerControlKeysService.findByPlayerId(playerId);

    if (!dbPlayerControlKeys) {
      dbPlayerControlKeys = await PlayerControlKeysService.create(playerId);
    }

    const playerControlKeys: PlayerControlKeys = PlayerControlKeysFactory.createPlayerControlKeys(dbPlayerControlKeys);
    this.cache.set(playerId, playerControlKeys);

    return playerControlKeys;
  }

  public static async update(playerId: string, data: TowersPlayerControlKeysUpdateInput): Promise<PlayerControlKeys> {
    const playerControlKeys: PlayerControlKeys = await this.findByPlayerId(playerId);

    Object.assign(playerControlKeys, data);

    await PlayerControlKeysService.update(playerControlKeys.id, playerControlKeys);

    await publishRedisEvent(ServerInternalEvents.GAME_CONTROL_KEYS_UPDATE, {
      userId: playerId,
      controlKeys: playerControlKeys.toPlainObject(),
    });

    return playerControlKeys;
  }

  public static delete(playerId: string): void {
    this.cache.delete(playerId);
  }
}
