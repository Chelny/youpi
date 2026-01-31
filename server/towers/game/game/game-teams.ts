import { MIN_ACTIVE_TEAMS_REQUIRED, MIN_ACTIVE_TEAMS_REQUIRED_TEST } from "@/constants/game";
import { Board } from "@/server/towers/game/board/board";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";
import { TEST_MODE } from "@/server/towers/utils/test";

export type GamePlayingTeam = { teamNumber: number; players: TablePlayer[] };

export class GameTeams {
  public static getTeamsFromPlayers(tableId: string, tablePlayers: TablePlayer[]): Set<number> {
    const teams: Set<number> = new Set<number>();

    for (const tablePlayer of tablePlayers) {
      const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(tableId, tablePlayer.playerId);
      if (!tableSeat) continue;
      teams.add(tableSeat.teamNumber);
    }

    return teams;
  }

  /**
   * Checks whether the game has the minimum required conditions to continue:
   * - At least 2 (ready/playing) seated users
   * - At least 2 different teams are represented
   *
   * Used to determine if a game can start or continue after a player leaves.
   *
   * @returns True if game has enough ready players across multiple teams
   */
  public static checkMinimumTeams(
    tableId: string,
    tablePlayers: TablePlayer[],
    condition: (tablePlayer: TablePlayer) => boolean,
  ): boolean {
    if (TEST_MODE) {
      // In test mode, require only 1 player/team
      return tablePlayers.length >= MIN_ACTIVE_TEAMS_REQUIRED_TEST && tablePlayers.every(condition);
    }

    // Need minimum of 2 players seated
    if (tablePlayers.length < 2) return false;

    // All must satisfy the condition (ready or playing)
    if (!tablePlayers.every(condition)) return false;

    const teams: Set<number> = this.getTeamsFromPlayers(tableId, tablePlayers);
    return teams.size >= MIN_ACTIVE_TEAMS_REQUIRED;
  }

  private static getSeatedPlayers(tablePlayers: TablePlayer[]): TablePlayer[] {
    return tablePlayers.filter((tp: TablePlayer): boolean => tp.seatNumber !== null);
  }

  public static checkMinimumReadyTeams(tableId: string, tablePlayers: TablePlayer[]): boolean {
    const seatedPlayers: TablePlayer[] = this.getSeatedPlayers(tablePlayers);
    return GameTeams.checkMinimumTeams(tableId, seatedPlayers, (tp: TablePlayer): boolean => tp.isReady === true);
  }

  public static checkMinimumPlayingTeams(tableId: string, tablePlayers: TablePlayer[]): boolean {
    const seatedPlayers: TablePlayer[] = this.getSeatedPlayers(tablePlayers);
    return GameTeams.checkMinimumTeams(tableId, seatedPlayers, (tp: TablePlayer): boolean => tp.isPlaying === true);
  }

  /**
   * Returns a list of currently active teams in the game.
   *
   * A team is considered alive if at least one of its users has a board
   * that exists and is not marked as game over.
   *
   * This method groups users by their `teamNumber` and filters out teams
   * where all members are either missing boards or have lost the game.
   *
   * @returns An array of tuples, where each tuple contains:
   *   - the team number (as `number`)
   *   - an array of `TablePlayer` objects who belong to that team
   *     (including users with and without active boards)
   */
  public static getActiveTeams(tableId: string, tablePlayers: TablePlayer[]): GamePlayingTeam[] {
    const teams: Map<number, TablePlayer[]> = new Map<number, TablePlayer[]>();

    for (const tablePlayer of tablePlayers) {
      const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(tableId, tablePlayer.playerId);
      if (!tableSeat || !tableSeat.teamNumber) continue;

      if (!teams.has(tableSeat.teamNumber)) {
        teams.set(tableSeat.teamNumber, []);
      }

      teams.get(tableSeat.teamNumber)!.push(tablePlayer);
    }

    return Array.from(teams.entries())
      .map(([teamNumber, players]: [number, TablePlayer[]]) => ({ teamNumber, players }))
      .filter(({ players }: { players: TablePlayer[] }) =>
        players.some((tablePlayer: TablePlayer) => {
          const board: Board | null | undefined = TableSeatManager.getSeatByPlayerId(
            tableId,
            tablePlayer.playerId,
          )?.board;
          return board && !board.isGameOver;
        }),
      );
  }

  /**
   * Checks whether the game is over based on remaining active teams.
   *
   * A team is considered "alive" if at least one user on that team has a board and is not marked as game over.
   * The game ends when only one such team remains.
   *
   * @returns `true` if the game is over and a winner is declared, otherwise `false`.
   */
  public static checkIfGameOver(tableId: string, tablePlayers: TablePlayer[]): boolean {
    return (
      this.getActiveTeams(tableId, tablePlayers).length <
      (TEST_MODE ? MIN_ACTIVE_TEAMS_REQUIRED_TEST : MIN_ACTIVE_TEAMS_REQUIRED)
    );
  }
}
