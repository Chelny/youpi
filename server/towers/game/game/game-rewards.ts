import { TableChatMessageType } from "db/client";
import type { Game } from "@/server/towers/game/game/game";
import { MIN_GRACE_PERIOD_SECONDS } from "@/constants/game";
import { CipherHeroManager } from "@/server/towers/game/cipher-hero-manager";
import { EloRating, EloRatingPlayer, EloResult } from "@/server/towers/game/elo-rating";
import { PlayerStatsManager } from "@/server/towers/modules/player-stats/player-stats.manager";
import { TableChatMessageManager } from "@/server/towers/modules/table-chat-message/table-chat-message.manager";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";

export async function handleRewards(
  game: Game,
  finalTimer: number | null = null,
  winners: TablePlayer[] = [],
): Promise<void> {
  const isEndedTooEarly: boolean = finalTimer !== null && finalTimer <= MIN_GRACE_PERIOD_SECONDS;
  const winnerIds: string[] = winners.map((tp: TablePlayer) => tp.playerId);
  const playerIdsThisRound: string[] = isEndedTooEarly ? [] : game.playerIdsThisRound;

  for (const playerId of playerIdsThisRound) {
    const tablePlayer: TablePlayer | undefined = game.table.players.find((tp: TablePlayer) => tp.playerId === playerId);
    if (!tablePlayer) continue;

    if (winnerIds.includes(playerId)) {
      await PlayerStatsManager.recordWin(playerId);

      if (tablePlayer.player.stats.isHeroEligible()) {
        const heroCode: string = CipherHeroManager.generateHeroCode(playerId);
        await TableChatMessageManager.create({
          table: {
            connect: { id: game.table.id },
          },
          player: {
            connect: { id: playerId },
          },
          text: null,
          type: TableChatMessageType.HERO_CODE,
          textVariables: { heroCode },
          visibleToUserId: tablePlayer.playerId,
        });
      }
    } else {
      await PlayerStatsManager.recordLoss(playerId);
    }
  }

  if (!isEndedTooEarly && game.table.isRated) {
    const roundTeams: Map<number, EloRatingPlayer[]> = new Map<number, EloRatingPlayer[]>();

    for (const { playerId, teamNumber } of game.playersThisRound) {
      const tablePlayer: TablePlayer | undefined = game.table.players.find(
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

    const ratingResults: EloResult[] = EloRating.rateTeams(roundTeams, winnerIds);
    for (const eloResult of ratingResults) {
      const tablePlayer: TablePlayer | undefined = game.table.players.find(
        (tp: TablePlayer) => tp.playerId === eloResult.playerId,
      );
      if (!tablePlayer) continue;

      await PlayerStatsManager.updateRating(tablePlayer.playerId, eloResult.newRating);
      await TableChatMessageManager.create({
        table: {
          connect: { id: game.table.id },
        },
        player: {
          connect: { id: tablePlayer.playerId },
        },
        text: null,
        type: TableChatMessageType.GAME_RATING,
        textVariables: {
          username: tablePlayer.player.user.username,
          oldRating: eloResult.oldRating,
          newRating: eloResult.newRating,
        },
        visibleToUserId: null,
      });
    }
  }
}
