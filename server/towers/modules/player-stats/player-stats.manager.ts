import { createId } from "@paralleldrive/cuid2";
import { PlayerStats, PlayerStatsProps } from "@/server/towers/modules/player-stats/player-stats.entity";

export class PlayerStatsManager {
  private static playerStats: Map<string, PlayerStats> = new Map<string, PlayerStats>();

  // ---------- Basic CRUD ------------------------------

  public static get(playerId: string): PlayerStats | undefined {
    return this.playerStats.get(playerId);
  }

  public static create(props: Omit<PlayerStatsProps, "id">): PlayerStats {
    const playerStats: PlayerStats | undefined = new PlayerStats({ id: createId(), ...props });
    this.playerStats.set(playerStats.playerId, playerStats);
    return playerStats;
  }

  public static upsert(props: PlayerStatsProps): PlayerStats {
    const playerStats: PlayerStats | undefined = this.playerStats.get(props.playerId);

    if (playerStats) {
      playerStats.wins = props.wins;
      playerStats.losses = props.losses;
      playerStats.rating = props.rating;
      playerStats.winHistory = props.winHistory;
      return playerStats;
    }

    return this.create(props);
  }

  public static delete(playerId: string): void {
    this.playerStats.delete(playerId);
  }

  // ---------- Player Stats Actions ------------------------------

  public static async recordWin(playerId: string): Promise<PlayerStats | null> {
    const playerStats: PlayerStats | undefined = this.playerStats.get(playerId);
    if (!playerStats) return null;

    await playerStats.recordWin();
    this.playerStats.set(playerStats.playerId, playerStats);

    return playerStats;
  }

  public static async recordLoss(playerId: string): Promise<PlayerStats | null> {
    const playerStats: PlayerStats | undefined = this.playerStats.get(playerId);
    if (!playerStats) return null;

    await playerStats.recordLoss();
    this.playerStats.set(playerStats.playerId, playerStats);

    return playerStats;
  }

  public static async updateRating(playerId: string, rating: number): Promise<void> {
    const playerStats: PlayerStats | undefined = this.get(playerId);
    if (!playerStats) return;

    await playerStats.setNewRating(rating);
    this.playerStats.set(playerStats.playerId, playerStats);
  }
}
