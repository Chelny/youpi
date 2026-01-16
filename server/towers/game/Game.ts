import { createId } from "@paralleldrive/cuid2";
import { TableChatMessageType } from "db/client";
import { GameState } from "db/client";
import { Server as IoServer } from "socket.io";
import type { Table } from "@/server/towers/classes/Table";
import {
  COUNTDOWN_START_NUMBER,
  COUNTDOWN_START_NUMBER_TEST,
  MIN_ACTIVE_TEAMS_REQUIRED,
  MIN_ACTIVE_TEAMS_REQUIRED_TEST,
  MIN_GRACE_PERIOD_SECONDS,
} from "@/constants/game";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import { TablePlayer, TablePlayerPlainObject } from "@/server/towers/classes/TablePlayer";
import { TableSeat } from "@/server/towers/classes/TableSeat";
import { Board } from "@/server/towers/game/board/Board";
import { CipherHeroManager } from "@/server/towers/game/CipherHeroManager";
import { EloRating, EloResult, EloUserRating } from "@/server/towers/game/EloRating";
import { PlayerTowersGame } from "@/server/towers/game/PlayerTowersGame";
import { TowersPieceBlockPlainObject } from "@/server/towers/game/TowersPieceBlock";
import { PlayerStatsManager } from "@/server/towers/managers/PlayerStatsManager";
import { TableChatMessageManager } from "@/server/towers/managers/TableChatMessageManager";
import { TablePlayerManager } from "@/server/towers/managers/TablePlayerManager";
import { TableSeatManager } from "@/server/towers/managers/TableSeatManager";
import { TEST_MODE } from "@/server/towers/utils/test";
import { delay } from "@/server/towers/utils/timers";

export interface GamePlainObject {
  readonly id: string
  readonly state: GameState
  readonly countdown: number | null
  readonly timer: number | null
  readonly playerIdsThisRound: string[]
  readonly winners: TablePlayerPlainObject[]
}

type RoundPlayer = { playerId: string; teamNumber: number };

export class Game {
  private io: IoServer;
  public readonly id: string;
  private readonly table: Table;
  private playersThisRound: RoundPlayer[] = [];
  private isUsersPlayingListSaved: boolean = false;
  private _state: GameState = GameState.WAITING;
  private _countdown: number | null = TEST_MODE ? COUNTDOWN_START_NUMBER_TEST : COUNTDOWN_START_NUMBER;
  private countdownIntervalId: NodeJS.Timeout | null = null;
  private _timer: number | null = null;
  private gameTimerIntervalId: NodeJS.Timeout | null = null;
  private isGameOver: boolean = false;
  public winners: TablePlayer[] = [];
  private playerGameInstances: Map<string, PlayerTowersGame> = new Map<string, PlayerTowersGame>();
  private playerGamesBySeat: Map<number, PlayerTowersGame> = new Map<number, PlayerTowersGame>();
  private gameOverCheckQueued: boolean = false;

  constructor(io: IoServer, table: Table) {
    this.io = io;
    this.id = createId();
    this.table = table;
  }

  public get playerIdsThisRound(): string[] {
    return this.playersThisRound.map((rp: RoundPlayer) => rp.playerId);
  }

  public set state(state: GameState) {
    // Clear board before starting a new game
    if (state === GameState.COUNTDOWN && state !== this._state) {
      this.table.seats.forEach((ts: TableSeat) => ts.clearSeatGame());
      this.emitTableSeatUpdates();
    }

    this._state = state;
    void this.emitGameStateToAll();
  }

  public get state(): GameState {
    return this._state;
  }

  public set countdown(countdown: number | null) {
    this._countdown = countdown;
    void this.emitCountdownToAll();
  }

  public get countdown(): number | null {
    return this._countdown;
  }

  public set timer(timer: number | null) {
    this._timer = timer;
    void this.emitTimerToAll();
  }

  public get timer(): number | null {
    return this._timer;
  }

  private getSeatedPlayers(): TablePlayer[] {
    return this.table.players.filter((tp: TablePlayer): boolean => tp.seatNumber !== null);
  }

  private getTeamsFromPlayers(tablePlayers: TablePlayer[]): Set<number> {
    const teams: Set<number> = new Set<number>();

    for (const tablePlayer of tablePlayers) {
      const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.table.id, tablePlayer.playerId);
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
  private checkMinimumTeams(players: TablePlayer[], condition: (p: TablePlayer) => boolean): boolean {
    if (TEST_MODE) {
      // In test mode, require only 1 player/team
      return players.length >= MIN_ACTIVE_TEAMS_REQUIRED_TEST && players.every(condition);
    }

    // Need minimum of 2 players seated
    if (players.length < 2) return false;

    // All must satisfy the condition (ready or playing)
    if (!players.every(condition)) return false;

    const teams: Set<number> = this.getTeamsFromPlayers(players);
    return teams.size >= MIN_ACTIVE_TEAMS_REQUIRED;
  }

  public checkMinimumReadyTeams(): boolean {
    const seatedPlayers: TablePlayer[] = this.getSeatedPlayers();
    return this.checkMinimumTeams(seatedPlayers, (tp: TablePlayer): boolean => tp.isReady === true);
  }

  public checkMinimumPlayingTeams(): boolean {
    const seatedPlayers: TablePlayer[] = this.getSeatedPlayers();
    return this.checkMinimumTeams(seatedPlayers, (tp: TablePlayer): boolean => tp.isPlaying === true);
  }

  public startCountdown(): void {
    this.countdown = TEST_MODE ? COUNTDOWN_START_NUMBER_TEST : COUNTDOWN_START_NUMBER;

    this.clearGameTimer(true);

    this.state = GameState.COUNTDOWN;

    this.countdownIntervalId = setInterval(() => {
      if (this.countdown !== null) {
        logger.debug(`[Towers] Countdown: ${this.countdown}`);

        if (this.countdown > 1) {
          this.countdown -= 1;

          if (!this.checkMinimumReadyTeams()) {
            this.clearCountdown();
            logger.debug("[Towers] Game Over: Not enough ready users or teams");
            this.gameOver();
          }
        } else if (this.countdown === 1) {
          this.clearCountdown();
          void this.startGame();
        }
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownIntervalId !== null) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }

    this.countdown = null;
  }

  private async startGame(): Promise<void> {
    // Initialize seats that are occupied
    this.table.seats.filter((ts: TableSeat) => ts.occupiedByPlayer).forEach((ts: TableSeat) => ts.initialize());

    const occupiedSeats: TableSeat[] = this.table.seats.filter((ts: TableSeat) => ts.occupiedByPlayer !== null);

    // Link partner boards (partner = adjacent seat by seatNumber)
    const getPartnerSeatNumber = (seatNumber: number): number =>
      seatNumber % 2 === 0 ? seatNumber + 1 : seatNumber - 1;

    const seatByNumber: Map<number, TableSeat> = new Map<number, TableSeat>();
    for (const occupiedSeat of occupiedSeats) {
      if (occupiedSeat.seatNumber != null) seatByNumber.set(occupiedSeat.seatNumber, occupiedSeat);
    }

    for (const tableSeat of occupiedSeats) {
      if (!tableSeat.board || tableSeat.seatNumber == null) continue;

      const partnerSeatNumber: number = getPartnerSeatNumber(tableSeat.seatNumber);
      const partnerSeat: TableSeat | undefined = seatByNumber.get(partnerSeatNumber);

      // Partner must exist, be occupied, and have a board
      if (partnerSeat?.occupiedByPlayer && partnerSeat.board) {
        const isSameTeam: boolean = partnerSeat.teamNumber === tableSeat.teamNumber;
        if (!isSameTeam) {
          tableSeat.board.partnerBoard = null;
          tableSeat.board.partnerSide = null;
        } else {
          tableSeat.board.partnerBoard = partnerSeat.board;
          tableSeat.board.partnerSide = partnerSeat.seatNumber > tableSeat.seatNumber ? "right" : "left";
        }
      } else {
        tableSeat.board.partnerBoard = null;
        tableSeat.board.partnerSide = null;
      }
    }

    // Start PlayerTowersGame instances for seated and ready players
    for (const tableSeat of occupiedSeats) {
      const tablePlayer: TablePlayer | undefined = tableSeat.occupiedByPlayerId
        ? TablePlayerManager.get(this.table.id, tableSeat.occupiedByPlayerId)
        : undefined;

      if (!tablePlayer) continue;
      if (!tablePlayer.isReady) continue;

      this.playersThisRound.push({ playerId: tablePlayer.playerId, teamNumber: tableSeat.teamNumber });

      const gameInstance: PlayerTowersGame = new PlayerTowersGame(
        this.io,
        this.table.id,
        this.table.players,
        tablePlayer,
        {
          queueSpeedDropNextPiece: (seatNumber: number) => this.queueSpeedDropNextPiece(seatNumber),
          requestGameOverCheck: () => this.requestGameOverCheck(),
        },
      );

      this.playerGameInstances.set(tablePlayer.playerId, gameInstance);

      if (tablePlayer.seatNumber != null) {
        this.playerGamesBySeat.set(tablePlayer.seatNumber, gameInstance);
      }

      tablePlayer.isPlaying = true;
      await TablePlayerManager.upsert(tablePlayer);

      gameInstance.startGameLoop();
    }

    this.startGameTimer();
  }

  private startGameTimer(): void {
    this.state = GameState.PLAYING;

    this.timer = 0;

    this.gameTimerIntervalId = setInterval(() => {
      if (this.state !== GameState.PLAYING || this.timer === null) return;
      if (this.isGameOver) return;

      if (this.checkIfGameOver()) {
        const finalTimer: number | null = this.timer;

        this.clearGameTimer();

        const aliveTeams: { teamNumber: number; players: TablePlayer[] }[] = this.getActiveTeams();

        if (aliveTeams.length === 0) {
          logger.debug("[Towers] Game Over: No alive teams.");
          return void this.gameOver(finalTimer);
        }

        const winningTeam: { teamNumber: number; players: TablePlayer[] } = aliveTeams[0];
        logger.debug(
          `[Towers] Game Over: Winning team: ${winningTeam.players.map((tp: TablePlayer) => tp.player.user.username)}`,
        );
        this.gameOver(finalTimer, winningTeam.players);
        return;
      }

      if (!this.isUsersPlayingListSaved && this.timer >= MIN_GRACE_PERIOD_SECONDS && this.checkMinimumPlayingTeams()) {
        this.playersThisRound = this.table.players
          .filter((tp: TablePlayer) => tp.isPlaying)
          .map((tp: TablePlayer) => {
            const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.table.id, tp.playerId);
            return {
              playerId: tp.playerId,
              teamNumber: tableSeat?.teamNumber ?? -1,
            };
          });

        this.isUsersPlayingListSaved = true;
      }

      this.timer += 1;

      if (this.timer <= MIN_GRACE_PERIOD_SECONDS && !this.checkMinimumPlayingTeams()) {
        const finalTimer: number | null = this.timer;

        this.clearGameTimer();

        logger.debug(
          `[Towers] Game Over: Not enough users or teams playing within the first ${MIN_GRACE_PERIOD_SECONDS} seconds.`,
        );
        this.gameOver(finalTimer);
      }
    }, 1000);
  }

  private clearGameTimer(shouldResetTimer: boolean = false): void {
    if (this.gameTimerIntervalId !== null) {
      clearInterval(this.gameTimerIntervalId);
      this.gameTimerIntervalId = null;
    }

    if (shouldResetTimer) {
      this.timer = null;
    }
  }

  public getPlayerGameBySeat(seatNumber: number): PlayerTowersGame | undefined {
    return this.playerGamesBySeat.get(seatNumber);
  }

  public async applyHooBlocksToOpponents(teamNumber: number, blocks: TowersPieceBlockPlainObject[]): Promise<void> {
    if (!blocks || blocks.length === 0) return;

    for (const playerGame of this.playerGameInstances.values()) {
      playerGame.applyHooBlocks({ teamNumber, blocks });
      await playerGame.sendGameStateToClient();
    }
  }

  public queueSpeedDropNextPiece(seatNumber: number): void {
    const gameInstance: PlayerTowersGame | undefined = this.playerGamesBySeat.get(seatNumber);
    if (!gameInstance) return;
    gameInstance.queueSpecialSpeedDropNextPiece();
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
  private getActiveTeams(): { teamNumber: number; players: TablePlayer[] }[] {
    const teams: Map<number, TablePlayer[]> = new Map();

    for (const tablePlayer of this.table.players) {
      const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.table.id, tablePlayer.playerId);
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
            this.table.id,
            tablePlayer.playerId,
          )?.board;
          return board && !board.isGameOver;
        }),
      );
  }

  /**
   * Handles logic when a user leaves the table during a game round.
   * - If the game is in countdown or early game phase (<= 15s), and valid teams are not present, game ends.
   * - If the game is playing (any time), and valid teams are NOT present after departure, game ends and last valid players become winners.
   * - Also removes the user from the current `playerIdsThisRound` list if necessary.
   * - Emits the updated GAME_OVER state to all users.
   *
   * @param tablePlayer - The player who left the table
   */
  public handleUserDepartureMidGame(tablePlayer: TablePlayer): void {
    const isEarlyExitDuringCountdown: boolean = this.state === GameState.COUNTDOWN;
    const isEarlyExitDuringPlay: boolean =
      this.state === GameState.PLAYING && this.timer !== null && this.timer <= MIN_GRACE_PERIOD_SECONDS;
    const isMidGame: boolean =
      this.state === GameState.PLAYING && this.timer !== null && this.timer > MIN_GRACE_PERIOD_SECONDS;

    // Handle departure during countdown or early game
    if (isEarlyExitDuringCountdown || isEarlyExitDuringPlay) {
      this.playersThisRound = this.checkMinimumPlayingTeams()
        ? this.playersThisRound.filter((rp: RoundPlayer) => rp.playerId !== tablePlayer.playerId)
        : [];
      return;
    }

    // Handle mid-game user exit — check if game is still valid
    if (isMidGame && !this.checkMinimumPlayingTeams()) {
      // Determine remaining players as winners
      this.winners = this.table.players.filter(
        (tp: TablePlayer) => tp.isPlaying && tp.playerId !== tablePlayer.playerId,
      );
      this.requestGameOverCheck();
    }
  }

  /**
   * Checks whether the game is over based on remaining active teams.
   *
   * A team is considered "alive" if at least one user on that team has a board and is not marked as game over.
   * The game ends when only one such team remains.
   *
   * @returns `true` if the game is over and a winner is declared, otherwise `false`.
   */
  private checkIfGameOver(): boolean {
    return this.getActiveTeams().length < (TEST_MODE ? MIN_ACTIVE_TEAMS_REQUIRED_TEST : MIN_ACTIVE_TEAMS_REQUIRED);
  }

  /**
   * Finalizes the game state and stops all active game loops.
   *
   * - Marks the game as over.
   * - Stops all `PlayerTowersGame` loops.
   * - Clears player game instances.
   * - Determines if the game ended too early (under `MIN_GRACE_PERIOD_SECONDS`).
   * - Emits the game-over state to all clients.
   * - Waits 10 seconds before resetting the game.
   *
   * @param finalTimer - The number of seconds the game lasted (used to check early exit).
   * @param winners - The winning players.
   */
  private async gameOver(finalTimer: number | null = null, winners: TablePlayer[] = []): Promise<void> {
    if (this.isGameOver) return;

    this.isGameOver = true;
    logger.debug("[Towers] Game stopped.");

    this.playerGameInstances.forEach((ptg: PlayerTowersGame) => ptg.stopGameLoop());
    this.playerGameInstances.clear();
    this.playerGamesBySeat.clear();

    this.state = GameState.GAME_OVER;

    const isEndedTooEarly: boolean = finalTimer !== null && finalTimer <= MIN_GRACE_PERIOD_SECONDS;
    this.winners = isEndedTooEarly ? [] : winners;
    const winnerIds: string[] = winners.map((tp: TablePlayer) => tp.playerId);
    const playerIdsThisRound: string[] = isEndedTooEarly ? [] : this.playerIdsThisRound;

    for (const playerId of playerIdsThisRound) {
      const tablePlayer: TablePlayer | undefined = this.table.players.find(
        (tp: TablePlayer) => tp.playerId === playerId,
      );
      if (!tablePlayer) continue;

      if (winnerIds.includes(playerId)) {
        tablePlayer.player.stats.recordWin();

        if (tablePlayer.player.stats.isHeroEligible()) {
          const heroCode: string = CipherHeroManager.generateHeroCode(tablePlayer.playerId);
          await TableChatMessageManager.create({
            tableId: this.table.id,
            player: tablePlayer.player,
            text: null,
            type: TableChatMessageType.HERO_CODE,
            textVariables: { heroCode },
            visibleToUserId: tablePlayer.playerId,
          });
        }
      } else {
        tablePlayer.player.stats.recordLoss();
      }
    }

    if (!isEndedTooEarly) {
      const roundTeams: Map<number, EloUserRating[]> = new Map<number, EloUserRating[]>();

      for (const { playerId, teamNumber } of this.playersThisRound) {
        const tablePlayer: TablePlayer | undefined = this.table.players.find(
          (tp: TablePlayer) => tp.playerId === playerId,
        );
        if (!tablePlayer) continue;

        if (!roundTeams.has(teamNumber)) {
          roundTeams.set(teamNumber, []);
        }

        roundTeams.get(teamNumber)!.push({
          playerId,
          rating: tablePlayer.player.stats.rating,
        });
      }

      if (this.table.isRated) {
        const ratingResults: EloResult[] = EloRating.rateTeams(roundTeams, winnerIds);

        ratingResults.forEach(async (er: EloResult) => {
          const tablePlayer: TablePlayer | undefined = this.table.players.find(
            (tp: TablePlayer) => tp.playerId === er.playerId,
          );

          if (tablePlayer) {
            await PlayerStatsManager.updateRating(tablePlayer.playerId, er.newRating);

            await TableChatMessageManager.create({
              tableId: this.table.id,
              player: tablePlayer.player,
              text: null,
              type: TableChatMessageType.GAME_RATING,
              textVariables: {
                username: tablePlayer.player.user.username,
                oldRating: er.oldRating,
                newRating: er.newRating,
              },
              visibleToUserId: null,
            });
          }
        });
      }
    }

    await publishRedisEvent(ServerInternalEvents.GAME_OVER, {
      tableId: this.table.id,
      winners: this.winners.map((tp: TablePlayer) => tp.toPlainObject()),
      playerResults: this.table.players
        .filter((tp: TablePlayer) => this.playerIdsThisRound.includes(tp.playerId))
        .map((tp: TablePlayer) => ({
          playerId: tp.playerId,
          isPlayedThisRound: this.playerIdsThisRound.includes(tp.playerId),
          isWinner: this.winners.some((winner: TablePlayer) => winner.playerId === tp.playerId),
          rating: tp.player.stats.rating,
        })),
    });

    await delay(10_000);

    this.reset();
  }

  public requestGameOverCheck(): void {
    if (this.gameOverCheckQueued) return;
    this.gameOverCheckQueued = true;

    queueMicrotask(() => {
      this.gameOverCheckQueued = false;

      if (this.isGameOver) return;
      if (this.state !== GameState.PLAYING) return;
      if (!this.checkIfGameOver()) return;

      const finalTimer: number = this.timer ?? 0;
      this.clearGameTimer();

      const playingTeams: { teamNumber: number; players: TablePlayer[] }[] = this.getActiveTeams();
      if (playingTeams.length === 0) {
        void this.gameOver(finalTimer);
        return;
      }

      void this.gameOver(finalTimer, playingTeams[0].players);
    });
  }

  private cleanupGame({ emitState = true, fullDestroy = false } = {}): void {
    this.clearCountdown();
    this.clearGameTimer();

    this.table.players
      .filter((tp: TablePlayer) => tp.isPlaying)
      .forEach(async (tp: TablePlayer) => {
        const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.table.id, tp.playerId);

        if (tableSeat?.board) {
          tableSeat.board.isGameOver = true;
        }

        tp.isPlaying = false;
        await TablePlayerManager.upsert(tp);
      });

    this.isGameOver = false;
    this._state = GameState.WAITING;
    this.playersThisRound = [];
    this.winners = [];

    if (fullDestroy) {
      this.table.seats.forEach((ts: TableSeat) => ts.clearSeatGame());
    }

    if (emitState) {
      this.emitGameStateToAll();
    }
  }

  private reset(): void {
    this.cleanupGame({ emitState: true, fullDestroy: false });
  }

  public destroy(): void {
    this.playerGameInstances.forEach((ptg: PlayerTowersGame) => ptg.stopGameLoop());
    this.playerGameInstances.clear();
    this.playerGamesBySeat.clear();
    this.cleanupGame({ emitState: false, fullDestroy: true });
  }

  private async emitTableSeatUpdates(): Promise<void> {
    await publishRedisEvent(ServerInternalEvents.GAME_TABLE_SEATS, {
      tableId: this.table.id,
      tableSeats: this.table.seats.map((ts: TableSeat) => ts.toPlainObject()),
    });
  }

  private async emitGameStateToAll(): Promise<void> {
    await publishRedisEvent(ServerInternalEvents.GAME_STATE, { tableId: this.table.id, gameState: this.state });
  }

  private async emitCountdownToAll(): Promise<void> {
    await publishRedisEvent(ServerInternalEvents.GAME_COUNTDOWN, {
      tableId: this.table.id,
      countdown: this.countdown,
    });
  }

  private async emitTimerToAll(): Promise<void> {
    await publishRedisEvent(ServerInternalEvents.GAME_TIMER, { tableId: this.table.id, timer: this.timer });
  }

  public toPlainObject(): GamePlainObject {
    return {
      id: this.id,
      state: this._state,
      countdown: this.countdown,
      timer: this.timer,
      playerIdsThisRound: this.playerIdsThisRound,
      winners: this.winners.map((tp: TablePlayer) => tp.toPlainObject()),
    };
  }
}
