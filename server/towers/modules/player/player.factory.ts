import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerControlKeys } from "@/server/towers/modules/player-control-keys/player-control-keys.entity";
import { PlayerStats } from "@/server/towers/modules/player-stats/player-stats.entity";
import { PlayerStatsFactory } from "@/server/towers/modules/player-stats/player-stats.factory";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserFactory } from "@/server/youpi/modules/user/user.factory";
import { TowersPlayerLite } from "@/types/prisma";

export class PlayerFactory {
  public static createPlayer(dbPlayer: TowersPlayerLite): Player {
    if (!dbPlayer.controlKeys || !dbPlayer.stats) throw Error("Control keys and/or stats not found.");

    const user: User = UserFactory.createUser(dbPlayer.user);
    const controlKeys: PlayerControlKeys = new PlayerControlKeys(dbPlayer.controlKeys);
    const stats: PlayerStats = PlayerStatsFactory.createPlayerStats(dbPlayer.stats);

    return new Player({ id: dbPlayer.id, user, controlKeys, stats });
  }
}
