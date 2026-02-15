import { HERO_CODE_ELIGIBILITY_TIME, HERO_CODE_REQUIRED_WINS } from "@/constants/game";

export interface PlayerStatsProps {
  id: string
  playerId: string
  rating: number
  gamesCompleted: number
  wins: number
  losses: number
  streak: number
  winHistory: Date[] | null
}

export interface PlayerStatsPlainObject {
  readonly id: string
  readonly playerId: string
  readonly rating: number
  readonly gamesCompleted: number
  readonly wins: number
  readonly losses: number
  readonly streak: number
}

export class PlayerStats {
  public readonly id: string;
  public readonly playerId: string;
  public rating: number;
  public gamesCompleted: number;
  public wins: number;
  public losses: number;
  public streak: number;
  public winHistory: Date[] | null;

  constructor(props: PlayerStatsProps) {
    this.id = props.id;
    this.playerId = props.playerId;
    this.rating = props.rating;
    this.gamesCompleted = props.gamesCompleted;
    this.wins = props.wins;
    this.losses = props.losses;
    this.streak = props.streak;
    this.winHistory = props.winHistory;
  }

  public async recordWin(): Promise<void> {
    this.gamesCompleted += 1;
    this.wins += 1;
    this.streak += 1;

    const now: Date = new Date();

    if (!this.winHistory) {
      this.winHistory = [now];
    } else {
      this.winHistory.push(now);
    }
  }

  public async recordLoss(): Promise<void> {
    this.gamesCompleted += 1;
    this.losses += 1;
    this.streak = 0;
  }

  public async setNewRating(rating: number): Promise<void> {
    this.rating = rating;
  }

  /**
   * Determines whether the user is eligible for a hero code,
   * defined as 25 wins within the last 2 hours.
   *
   * @returns true if eligible, false otherwise
   */
  public isHeroEligible(): boolean {
    if (!this.winHistory) return false;

    const now: number = Date.now();

    // Count wins within the time window
    const recentWins: Date[] = this.winHistory.filter((date: Date) => {
      return now - date.getTime() <= HERO_CODE_ELIGIBILITY_TIME;
    });

    return recentWins.length >= HERO_CODE_REQUIRED_WINS;
  }

  public toPlainObject(): PlayerStatsPlainObject {
    return {
      id: this.id,
      playerId: this.playerId,
      rating: this.rating,
      gamesCompleted: this.gamesCompleted,
      wins: this.wins,
      losses: this.losses,
      streak: this.streak,
    };
  }
}
