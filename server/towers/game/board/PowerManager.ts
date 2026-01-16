import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import { TablePlayer } from "@/server/towers/classes/TablePlayer";
import { TableSeat } from "@/server/towers/classes/TableSeat";
import { Board, BoardGrid } from "@/server/towers/game/board/Board";
import {
  buildDefaultRegistry,
  PowerEffect,
  PowerEffectContext,
  PowerEffectRegistry,
} from "@/server/towers/game/board/PowerEffectRegistry";
import { TowersBlockLetter, TowersBlockPowerType } from "@/server/towers/game/PieceBlock";
import { PowerBarItem, PowerBarItemPlainObject } from "@/server/towers/game/PowerBar";
import { SpecialDiamond, SpecialDiamondPlainObject } from "@/server/towers/game/SpecialDiamond";
import { TowersPieceBlock, TowersPieceBlockPlainObject } from "@/server/towers/game/TowersPieceBlock";
import { TableSeatManager } from "@/server/towers/managers/TableSeatManager";
import { isTowersPieceBlock } from "@/server/towers/utils/piece-type-check";
import { TEST_MODE } from "@/server/towers/utils/test";

type PowerManagerDeps = {
  queueSpeedDropNextPiece: (seatNumber: number) => void
};

export class PowerManager {
  private tableId: string;
  private players: TablePlayer[];
  private tablePlayer: TablePlayer;
  private tableSeat?: TableSeat;
  private targetTablePlayer?: TablePlayer;
  private readonly registry: PowerEffectRegistry = buildDefaultRegistry();

  constructor(
    tableId: string,
    players: TablePlayer[],
    tablePlayer: TablePlayer,
    private deps: PowerManagerDeps,
  ) {
    this.tableId = tableId;
    this.players = players;
    this.tablePlayer = tablePlayer;
    this.tableSeat = TableSeatManager.getSeatByPlayerId(tableId, tablePlayer.playerId);
  }

  /**
   * Builds the execution context passed to all power effects.
   *
   * The context is a snapshot of the current player state and board references
   * at the moment a power is applied. It provides controlled access to:
   *
   * - The source player (who triggered the power)
   * - The optional target player (for attack / special powers)
   * - The source player's seat, board, and grid
   * - A safe `setGrid` helper used by effects to replace the board grid atomically
   * - The source player's power bar
   * - Optional debug metadata for logging and tracing (usernames)
   */
  private makeContext(): PowerEffectContext {
    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);
    const board: Board | null = tableSeat?.board ?? null;

    return {
      tableId: this.tableId,
      seat: tableSeat,
      game: {
        queueSpeedDropNextPiece: this.deps.queueSpeedDropNextPiece,
      },
      board,
      grid: board?.grid,
      setGrid: (grid: BoardGrid): void => {
        if (board) board.grid = grid;
      },
      powerBar: tableSeat?.powerBar ?? null,
      source: this.tablePlayer,
      target: this.targetTablePlayer,
    };
  }

  /**
   * Applies the specified power item effect to the current board,
   * depending on the item's type and whether it's an attack or defense.
   *
   * @param powerItem - The power item to apply (either a TowersPieceBlock or SpecialDiamond).
   */
  public applyPower({ powerItem }: { powerItem: PowerBarItemPlainObject }): void {
    if ("powerLevel" in powerItem) {
      const item: TowersPieceBlock = TowersPieceBlock.fromPlainObject(powerItem as TowersPieceBlockPlainObject);
      const mode: TowersBlockPowerType = item.powerType;
      const effect: PowerEffect<TowersPieceBlock> | undefined = this.registry.getTowers(
        item.letter as TowersBlockLetter,
        mode,
      );
      if (!effect) return;

      const ctx: PowerEffectContext = this.makeContext();

      logger.debug(
        `[Towers] Apply Power - ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}: ${item.letter}:${mode} (${item.powerLevel})`,
      );

      effect.apply(ctx, item);
      return;
    }

    if ("powerType" in powerItem) {
      const item: SpecialDiamond = SpecialDiamond.fromPlainObject(powerItem as SpecialDiamondPlainObject);
      const effect: PowerEffect<SpecialDiamond> | undefined = this.registry.getDiamond(item.powerType);
      if (!effect) return;

      const ctx: PowerEffectContext = this.makeContext();

      logger.debug(
        `[Towers] Apply Special Power - ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}: diamond:${item.powerType}`,
      );

      effect.apply(ctx, item);
      return;
    }

    logger.warn("[Towers] Unknown power item");
  }

  /**
   * Sends attack or defense to a target player or a random opponent.
   *
   * @param targetSeatNumber - Optional. The seat number to target.
   */
  public usePower(targetSeatNumber?: number): void {
    this.targetTablePlayer = undefined; // Clear previous target

    // Refresh seat
    this.tableSeat = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);

    const powerItem: PowerBarItem | null | undefined = this.tableSeat?.powerBar?.useItem();
    if (!powerItem) return;

    const resolveTarget = (target: TablePlayer): TablePlayer => {
      return TEST_MODE ? this.tablePlayer : target;
    };

    const isAttackPower: boolean =
      (isTowersPieceBlock(powerItem) && powerItem.powerType === "attack") ||
      (powerItem instanceof SpecialDiamond && ["speed drop", "remove powers"].includes(powerItem.powerType));

    const isDefensePower: boolean =
      (isTowersPieceBlock(powerItem) && powerItem.powerType === "defense") ||
      (powerItem instanceof SpecialDiamond && ["remove stones"].includes(powerItem.powerType));

    const allActiveUsers: TablePlayer[] = this.players.filter((tablePlayer: TablePlayer) => {
      const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, tablePlayer.playerId);
      return tableSeat && tablePlayer.isPlaying && !tableSeat.board?.isGameOver;
    });

    const partner: TablePlayer | undefined = this.players.find((tablePlayer: TablePlayer) =>
      this.isPartner(tablePlayer),
    );
    const isOpponent = (tablePlayer: TablePlayer): boolean =>
      tablePlayer.playerId !== this.tablePlayer.playerId && !this.isPartner(tablePlayer);
    const opponents: TablePlayer[] = allActiveUsers.filter((tablePlayer: TablePlayer) => isOpponent(tablePlayer));

    const sendPowerToTarget = async (targetTablePlayer: TablePlayer): Promise<void> => {
      if (!this.tableSeat) return;

      if (!TEST_MODE && isAttackPower && this.isPartner(targetTablePlayer) && typeof targetSeatNumber === "undefined") {
        logger.warn(`[Towers] Blocked spacebar attack to partner: ${targetTablePlayer.player.user.username}`);
        return;
      }

      const target: TablePlayer = resolveTarget(targetTablePlayer);
      this.targetTablePlayer = target;

      await publishRedisEvent(ServerInternalEvents.GAME_POWER_USE, {
        tableId: this.tableId,
        powerItem: powerItem.toPlainObject(),
        source: this.tablePlayer.toPlainObject(),
        target: target.toPlainObject(),
      });
    };

    // Handle number key press (explicit target)
    if (typeof targetSeatNumber !== "undefined") {
      const targetTablePlayer: TablePlayer | undefined = allActiveUsers.find((tablePlayer: TablePlayer) => {
        const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, tablePlayer.playerId);
        return tableSeat?.seatNumber === targetSeatNumber;
      });

      if (typeof targetTablePlayer !== "undefined") {
        if (TEST_MODE || (isAttackPower && isOpponent(targetTablePlayer)) || isDefensePower) {
          void sendPowerToTarget(targetTablePlayer);
        } else {
          logger.warn(`[Towers] Invalid target at seat #${targetSeatNumber} for power: ${powerItem.powerType}`);
        }
      } else {
        logger.warn(`[Towers] Target not found at seat #${targetSeatNumber}`);
      }
    }

    // Handle spacebar press (no target specified)
    else if (isAttackPower) {
      if (TEST_MODE) {
        void sendPowerToTarget(this.tablePlayer); // Self
      } else if (opponents.length > 0) {
        const targetTablePlayer: TablePlayer = opponents[Math.floor(Math.random() * opponents.length)];
        void sendPowerToTarget(targetTablePlayer);
      }
    } else if (isDefensePower) {
      if (TEST_MODE) {
        void sendPowerToTarget(this.tablePlayer); // Self
      } else {
        // Defense to self
        this.applyPower({ powerItem });

        // Also send to partner, if they exist and playing
        if (typeof partner !== "undefined" && this.tableSeat?.tableId) {
          const partnerTableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(
            this.tableId,
            partner.playerId,
          );

          if (typeof partnerTableSeat !== "undefined" && !partnerTableSeat?.board?.isGameOver) {
            void sendPowerToTarget(partner);
          }
        }
      }
    }
  }

  /**
   * Determines if the given player is on the same team.
   *
   * @param tablePlayer - The player to check.
   * @returns True if the player is a partner; otherwise, false.
   */
  private isPartner(tablePlayer: TablePlayer): boolean {
    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, tablePlayer.playerId);
    return (
      !!this.tableSeat &&
      !!tableSeat &&
      tableSeat.teamNumber === this.tableSeat.teamNumber &&
      tablePlayer.playerId !== this.tablePlayer.playerId
    );
  }
}
