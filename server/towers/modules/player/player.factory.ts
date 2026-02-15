import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerControlKeysFactory } from "@/server/towers/modules/player-control-keys/player-control-keys.factory";
import { PlayerStatsFactory } from "@/server/towers/modules/player-stats/player-stats.factory";
import { UserFactory } from "@/server/youpi/modules/user/user.factory";
import { TowersPlayerLite } from "@/types/prisma";

export class PlayerFactory {
  public static createPlayer(dbPlayer: TowersPlayerLite): Player {
    if (!dbPlayer.controlKeys || !dbPlayer.stats) throw Error("Control keys and/or stats not found.");

    return new Player({
      ...dbPlayer,
      user: UserFactory.createUser(dbPlayer.user),
      controlKeys: PlayerControlKeysFactory.createPlayerControlKeys(dbPlayer.controlKeys),
      stats: PlayerStatsFactory.createPlayerStats(dbPlayer.stats),
    });
  }
}
