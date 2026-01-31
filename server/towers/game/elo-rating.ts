export interface EloResult {
  playerId: string
  oldRating: number
  newRating: number
  delta: number
}

export interface EloRatingPlayer {
  playerId: string
  rating: number
}

interface EloRatingTeam {
  teamNumber: number
  players: EloRatingPlayer[]
  placement: number // 1 = winner, 2 = runner-up, etc
}

const avg = (numbers: number[]): number =>
  numbers.reduce((sum: number, value: number) => sum + value, 0) / numbers.length;

export class EloRating {
  // Elo K-factor: maximum rating points a player can gain or lose in a single match
  private static readonly K: number = 16;

  /**
   * Calculates Elo rating changes for a multi-team match.
   *
   * @param teams - Map of teamNumber => players with current ratings
   * @param winnerIds - Player IDs belonging to the winning team(s)
   * @returns Per-player Elo rating results
   */
  public static rateTeams(teams: Map<number, EloRatingPlayer[]>, winnerIds: string[]): EloResult[] {
    const teamsPlayed: EloRatingTeam[] = this.assignPlacements(teams, winnerIds);
    return this.calculateDeltas(teamsPlayed);
  }

  /**
   * Assign placement numbers to teams dynamically based on winners.
   *
   * @param teams - Map of teamNumber => EloRatingPlayer[]
   * @param winners - Array of winning player IDs
   * @returns EloRatingTeam[] with placement assigned
   */
  private static assignPlacements(teams: Map<number, EloRatingPlayer[]>, winners: string[]): EloRatingTeam[] {
    const winningTeams: EloRatingTeam[] = [];
    const losingTeams: EloRatingTeam[] = [];

    for (const [teamNumber, players] of teams.entries()) {
      const isWinnerTeam: boolean = players.some((erp: EloRatingPlayer) => winners.includes(erp.playerId));
      const team: EloRatingTeam = {
        teamNumber,
        players,
        placement: 0, // Temporary value
      };

      if (isWinnerTeam) {
        winningTeams.push(team);
      } else {
        losingTeams.push(team);
      }
    }

    // Sort losing teams by avg rating descending
    losingTeams.sort((eta: EloRatingTeam, etb: EloRatingTeam) => {
      const avgA: number = avg(eta.players.map((erp: EloRatingPlayer) => erp.rating));
      const avgB: number = avg(etb.players.map((erp: EloRatingPlayer) => erp.rating));
      return avgB - avgA;
    });

    // Assign placements
    winningTeams.forEach((ert: EloRatingTeam) => (ert.placement = 1));
    losingTeams.forEach((ert: EloRatingTeam, index: number) => (ert.placement = index + 2));

    return [...winningTeams, ...losingTeams];
  }

  /**
   * Calculates new ratings for an arbitrary number of teams.
   *
   * Algorithm:
   *  1. Compare every team to every other team (pair-wise Elo).
   *  2. Sum the Δ from all pairings for each team.
   *  3. Apply the same team-delta to every player on that team.
   *
   * @param teams - Teams with assigned placements and player ratings
   * @returns Per-player Elo rating changes
   */
  private static calculateDeltas(teams: EloRatingTeam[]): EloResult[] {
    const results: Map<string, EloResult> = new Map<string, EloResult>();

    for (const teamA of teams) {
      let deltaSum: number = 0;

      for (const teamB of teams) {
        if (teamA === teamB) continue;

        const sA: number =
          teamA.placement < teamB.placement
            ? 1 // Win
            : teamA.placement > teamB.placement
              ? 0 // Loss
              : 0.5; // Draw

        const rA: number = avg(teamA.players.map((erp: EloRatingPlayer) => erp.rating));
        const rB: number = avg(teamB.players.map((erp: EloRatingPlayer) => erp.rating));
        const expA: number = 1 / (1 + 10 ** ((rB - rA) / 400));

        deltaSum += EloRating.K * (sA - expA);
      }

      const teamDelta: number = Math.round(deltaSum);

      teamA.players.forEach((erp: EloRatingPlayer) => {
        results.set(erp.playerId, {
          playerId: erp.playerId,
          oldRating: erp.rating,
          newRating: erp.rating + teamDelta,
          delta: teamDelta,
        });
      });
    }

    return [...results.values()];
  }
}
