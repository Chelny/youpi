import { TowersPlayerStats } from "db/client";
import { PlayerStats } from "@/server/towers/modules/player-stats/player-stats.entity";
import { PlayerStatsFactory } from "@/server/towers/modules/player-stats/player-stats.factory";
import { PlayerStatsService } from "@/server/towers/modules/player-stats/player-stats.service";
import { datesToJson } from "@/server/towers/utils/date";

export class PlayerStatsManager {
  private static cache: Map<string, PlayerStats> = new Map<string, PlayerStats>();

  public static async findByPlayerId(playerId: string): Promise<PlayerStats> {
    const cached: PlayerStats | undefined = this.cache.get(playerId);
    if (cached) return cached;

    let dbPlayerStats: TowersPlayerStats | null = await PlayerStatsService.findByPlayerId(playerId);

    if (!dbPlayerStats) {
      dbPlayerStats = await PlayerStatsService.create(playerId);
    }

    const playerStats: PlayerStats = PlayerStatsFactory.createPlayerStats(dbPlayerStats);
    this.cache.set(playerId, playerStats);

    return playerStats;
  }

  public static async recordWin(playerId: string): Promise<PlayerStats | null> {
    const playerStats: PlayerStats = await this.findByPlayerId(playerId);
    await playerStats.recordWin();

    await PlayerStatsService.update(playerStats.id, {
      gamesCompleted: playerStats.gamesCompleted,
      wins: playerStats.wins,
      streak: playerStats.streak,
      winHistory: datesToJson(playerStats.winHistory),
    });

    return playerStats;
  }

  public static async recordLoss(playerId: string): Promise<PlayerStats | null> {
    const playerStats: PlayerStats = await this.findByPlayerId(playerId);
    await playerStats.recordLoss();

    await PlayerStatsService.update(playerStats.id, {
      gamesCompleted: playerStats.gamesCompleted,
      losses: playerStats.losses,
      streak: playerStats.streak,
    });

    return playerStats;
  }

  public static async updateRating(playerId: string, rating: number): Promise<PlayerStats | null> {
    const playerStats: PlayerStats = await this.findByPlayerId(playerId);
    await playerStats.setNewRating(rating);

    await PlayerStatsService.update(playerStats.id, {
      rating: playerStats.rating,
    });

    return playerStats;
  }

  public static delete(playerId: string): void {
    this.cache.delete(playerId);
  }
}
