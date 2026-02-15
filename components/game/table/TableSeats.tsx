import { Dispatch, ReactNode, SetStateAction, useMemo } from "react";
import clsx from "clsx/lite";
import { GameState, TableInvitationStatus, TableType } from "db/enums";
import PlayerBoardSkeleton from "@/components/skeleton/PlayerBoardSkeleton";
import PlayerBoard from "@/components/towers/PlayerBoard";
import { useSocket } from "@/context/SocketContext";
import { ServerTowersSeat, ServerTowersTeam } from "@/interfaces/table-seats";
import { BoardPlainObject } from "@/server/towers/game/board/board";
import { NextPiecesPlainObject } from "@/server/towers/game/next-pieces";
import { PiecePlainObject } from "@/server/towers/game/pieces/piece";
import { PowerBarItemPlainObject, PowerBarPlainObject } from "@/server/towers/game/power-bar";
import { PlayerControlKeysPlainObject } from "@/server/towers/modules/player-control-keys/player-control-keys.entity";
import { TableLitePlainObject } from "@/server/towers/modules/table/table.entity";
import { TableInvitationPlainObject } from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { TablePlayerPlainObject } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeatPlainObject } from "@/server/towers/modules/table-seat/table-seat.entity";
import { Language, languages } from "@/translations/languages";
import { groupAndStructureSeats } from "@/utils/get-structured-teams";

type TableSeatsProps = {
  isTableHydrated: boolean
  roomId: string
  tableId: string
  isSocialRoom: boolean
  tableInfo: TableLitePlainObject | null
  seats: TableSeatPlainObject[]
  players: TablePlayerPlainObject[]
  invitations: TableInvitationPlainObject[]
  currentTablePlayer?: TablePlayerPlainObject
  controlKeys: PlayerControlKeysPlainObject | null
  gameStateBySeat: Record<
    number,
    {
      board: BoardPlainObject | null
      nextPieces: NextPiecesPlainObject | null
      powerBar: PowerBarPlainObject | null
      currentPiece: PiecePlainObject | null
    }
  >
  seatNumber: number | null
  gameState: GameState
  onSit: (seatNumber: number) => void
  onStand: () => void
  onStartGame: () => void
  onSetNextPowerBarItem: Dispatch<SetStateAction<PowerBarItemPlainObject | undefined>>
};

export function TableSeats({
  isTableHydrated,
  roomId,
  tableId,
  isSocialRoom,
  tableInfo,
  seats,
  players,
  invitations,
  currentTablePlayer,
  controlKeys,
  gameStateBySeat,
  seatNumber,
  gameState,
  onSit,
  onStand,
  onStartGame,
  onSetNextPowerBarItem,
}: TableSeatsProps): ReactNode {
  const { session } = useSocket();
  const SKELETON_UI_SEATS: ServerTowersTeam[] = [
    { teamNumber: 1, seats: [{ seatNumber: 1 }, { seatNumber: 2 }] },
    { teamNumber: 2, seats: [{ seatNumber: 3 }, { seatNumber: 4 }] },
    { teamNumber: 3, seats: [{ seatNumber: 5 }, { seatNumber: 6 }] },
    { teamNumber: 4, seats: [{ seatNumber: 7 }, { seatNumber: 8 }] },
  ] as ServerTowersTeam[];

  const isSitAccessGranted: boolean = useMemo(() => {
    if (!currentTablePlayer?.playerId) return false;

    // If user is already seated, they keep access
    if (currentTablePlayer?.seatNumber !== null) return true;

    // Table host
    if (tableInfo?.hostPlayerId === currentTablePlayer?.playerId) return true;

    // Public table
    if (tableInfo?.tableType === TableType.PUBLIC) return true;

    // Protected or Private → invitation required
    return !!invitations.some(
      (ti: TableInvitationPlainObject) =>
        ti.inviteePlayerId === session?.user.id && ti.status === TableInvitationStatus.ACCEPTED,
    );
  }, [tableInfo, invitations, currentTablePlayer]);

  const uiSeats: ServerTowersTeam[] = useMemo(() => {
    return groupAndStructureSeats(seats, seatNumber);
  }, [seats, seatNumber]);

  const renderedSeats: ServerTowersTeam[] = uiSeats.length > 0 ? uiSeats : SKELETON_UI_SEATS;
  const isPlayerBoardVisible: boolean = uiSeats.length > 0 && isTableHydrated;
  const currentLanguage: Language | undefined = languages.find(
    (language: Language) => language.locale === session?.user.language,
  );

  const isPlayerSeated = useMemo(() => {
    return uiSeats.some((team: ServerTowersTeam) =>
      team.seats.some((seat: ServerTowersSeat) => seat.occupiedByPlayerId === session?.user.id),
    );
  }, [uiSeats, session?.user.id]);

  const seatedTeamsCount = useMemo(() => {
    const seatedTeams: Set<number> = new Set<number>();

    if (!uiSeats || uiSeats.length === 0) return 0;

    uiSeats.forEach((team: ServerTowersTeam) => {
      const hasSeatedPlayer: boolean = team.seats.some((seat: ServerTowersSeat) => !!seat.occupiedByPlayerId);
      if (hasSeatedPlayer) {
        seatedTeams.add(team.teamNumber);
      }
    });

    return seatedTeams.size;
  }, [uiSeats]);

  return (
    <>
      {renderedSeats.map((group: ServerTowersTeam, index: number) => (
        <div
          key={group.teamNumber}
          className={clsx(index === 0 && "flex flex-row justify-center items-start h-max")}
          style={{ gridArea: `team${index + 1}` }}
          dir="ltr"
        >
          <div className={index === 0 ? "contents" : "flex flex-row justify-center items-center"}>
            {group.seats.map((seat: ServerTowersSeat) => {
              const tablePlayerForSeat: TablePlayerPlainObject | undefined = players.find(
                (tp: TablePlayerPlainObject) => tp.playerId === seat.occupiedByPlayerId,
              );

              const isOpponentBoard: boolean = index !== 0;
              const isReversed: boolean = seat.seatNumber % 2 === 0;

              return isPlayerBoardVisible ? (
                <PlayerBoard
                  key={seat.seatNumber}
                  roomId={roomId}
                  tableId={tableId}
                  seat={seat}
                  isOpponentBoard={isOpponentBoard}
                  isReversed={isReversed}
                  controlKeys={controlKeys}
                  gameState={gameState}
                  isSitAccessGranted={isSitAccessGranted}
                  seatedTeamsCount={seatedTeamsCount}
                  isPlayerSeated={isPlayerSeated}
                  isPlayerReady={!!tablePlayerForSeat?.isReady}
                  isPlayerPlaying={!!tablePlayerForSeat?.isPlaying}
                  gameStateForSeat={gameStateBySeat[seat.seatNumber]}
                  isRatingsVisible={!isSocialRoom}
                  onSit={onSit}
                  onStand={onStand}
                  onStartGame={onStartGame}
                  onNextPowerBarItem={(nextPowerBarItem: PowerBarItemPlainObject | undefined) =>
                    onSetNextPowerBarItem(nextPowerBarItem)
                  }
                />
              ) : (
                <PlayerBoardSkeleton
                  key={seat.seatNumber}
                  isOpponentBoard={isOpponentBoard}
                  isReversed={isReversed}
                  dir={currentLanguage?.rtl ? "rtl" : "ltr"}
                />
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
