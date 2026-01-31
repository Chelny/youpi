import { TableSeatPlainObject } from "@/server/towers/modules/table-seat/table-seat.entity";

export interface ServerTowersTeam {
  teamNumber: number
  seats: ServerTowersSeat[]
}

export interface ServerTowersSeat extends TableSeatPlainObject {
  targetNumber: number
  isReversed: boolean
}
