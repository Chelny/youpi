import { ServerTowersSeat, ServerTowersTeam } from "@/interfaces/table-seats";
import { TableSeatPlainObject } from "@/server/towers/modules/table-seat/table-seat.entity";

/**
 * Groups table seats into teams and optionally reorders them from the perspective of a player.
 *
 * - By default (non-seated users, or users at seat #1 or #2), the order is:
 *   [[1,2], [3,4], [5,6], [7,8]] → teams 1, 2, 3, 4 in that order.
 *
 * - If the viewer is seated:
 *   - Seat #3 or #4 → their team (team 2) is placed first: order [2,1,3,4].
 *   - Seat #5 or #6 → their team (team 3) is placed first: order [3,2,1,4].
 *   - Seat #7 or #8 → their team (team 4) is placed first: order [4,2,3,1].
 *   - Seat #1 or #2 → stays default.
 *
 * Inside each team, seats are always sorted numerically by seatNumber.
 *
 * @param tableSeats - The flat array of seats from the table.
 * @param seatNumber - The seat number of the viewing player, or null if not seated.
 * @returns A list of teams with seats structured and optionally reordered.
 */
export const groupAndStructureSeats = (
  tableSeats: TableSeatPlainObject[],
  seatNumber: number | null = null,
): ServerTowersTeam[] => {
  const teamMap: Map<number, ServerTowersSeat[]> = new Map();

  // Group seats by team
  for (const tableSeat of tableSeats) {
    if (!teamMap.has(tableSeat.teamNumber)) {
      teamMap.set(tableSeat.teamNumber, []);
    }

    const serverSeat: ServerTowersSeat = {
      ...tableSeat,
      targetNumber: tableSeat.seatNumber,
      isReversed: tableSeat.seatNumber % 2 === 0,
    };

    teamMap.get(tableSeat.teamNumber)!.push(serverSeat);
  }

  // Sort seats inside each team by seatNumber
  for (const seats of teamMap.values()) {
    seats.sort((a: ServerTowersSeat, b: ServerTowersSeat) => a.seatNumber - b.seatNumber);
  }

  // Convert Map to sorted array of teams
  const teams: ServerTowersTeam[] = [...teamMap.entries()]
    .sort(([aTeamNumber], [bTeamNumber]) => aTeamNumber - bTeamNumber)
    .map(([teamNumber, seats]: [number, ServerTowersSeat[]]) => ({ teamNumber, seats }));

  // Perspective-aware reordering
  if (seatNumber) {
    const index: number = teams.findIndex((team: ServerTowersTeam) =>
      team.seats.some((seat: ServerTowersSeat) => seat.seatNumber === seatNumber),
    );

    if (index > 0) {
      // Swap the viewer’s team to the front
      ;[teams[0], teams[index]] = [teams[index], teams[0]];

      // Swap targetNumber between seats for proper orientation
      for (let i = 0; i < teams[0].seats.length; i++) {
        const tmp: number = teams[0].seats[i].targetNumber;
        teams[0].seats[i].targetNumber = teams[index].seats[i].targetNumber;
        teams[index].seats[i].targetNumber = tmp;
      }
    }
  }

  return teams;
};
