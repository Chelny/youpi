export type GameLoopDependencies = {
  queueSpeedDropNextPiece: (seatNumber: number) => void
  requestGameOverCheck: () => void
};
