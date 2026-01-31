import { JsonValue } from "@prisma/client/runtime/client";
import { TowersPlayerStats } from "db/client";
import { PlayerStats, PlayerStatsPlainObject } from "@/server/towers/modules/player-stats/player-stats.entity";

export class PlayerStatsFactory {
  public static createPlayerStats(dbPlayerStats: TowersPlayerStats): PlayerStats {
    return new PlayerStats({
      ...dbPlayerStats,
      winHistory: Array.isArray(dbPlayerStats.winHistory)
        ? dbPlayerStats.winHistory.map((v: JsonValue) => new Date(v as string | number | Date))
        : null,
    });
  }

  public static convertToPlainObject(dbPlayerStats: TowersPlayerStats): PlayerStatsPlainObject {
    const playerStats: PlayerStats = this.createPlayerStats(dbPlayerStats);
    return playerStats.toPlainObject();
  }
}
