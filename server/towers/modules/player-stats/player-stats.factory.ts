import { TowersPlayerStats } from "db/client";
import { PlayerStats, PlayerStatsPlainObject } from "@/server/towers/modules/player-stats/player-stats.entity";
import { jsonToDates } from "@/server/towers/utils/date";

export class PlayerStatsFactory {
  public static createPlayerStats(dbPlayerStats: TowersPlayerStats): PlayerStats {
    return new PlayerStats({
      ...dbPlayerStats,
      winHistory: jsonToDates(dbPlayerStats.winHistory),
    });
  }

  public static convertToPlainObject(dbPlayerStats: TowersPlayerStats): PlayerStatsPlainObject {
    const playerStats: PlayerStats = this.createPlayerStats(dbPlayerStats);
    return playerStats.toPlainObject();
  }
}
