export interface PlayerControlKeysProps {
  id: string
  playerId: string
  moveLeft: string
  moveRight: string
  cycleBlock: string
  dropPiece: string
  useItem: string
  useItemOnPlayer1: string
  useItemOnPlayer2: string
  useItemOnPlayer3: string
  useItemOnPlayer4: string
  useItemOnPlayer5: string
  useItemOnPlayer6: string
  useItemOnPlayer7: string
  useItemOnPlayer8: string
}

export interface PlayerControlKeysPlainObject {
  readonly id: string
  readonly playerId: string
  readonly moveLeft: string
  readonly moveRight: string
  readonly cycleBlock: string
  readonly dropPiece: string
  readonly useItem: string
  readonly useItemOnPlayer1: string
  readonly useItemOnPlayer2: string
  readonly useItemOnPlayer3: string
  readonly useItemOnPlayer4: string
  readonly useItemOnPlayer5: string
  readonly useItemOnPlayer6: string
  readonly useItemOnPlayer7: string
  readonly useItemOnPlayer8: string
}

export class PlayerControlKeys {
  public readonly id: string;
  public readonly playerId: string;
  public moveLeft: string;
  public moveRight: string;
  public cycleBlock: string;
  public dropPiece: string;
  public useItem: string;
  public useItemOnPlayer1: string;
  public useItemOnPlayer2: string;
  public useItemOnPlayer3: string;
  public useItemOnPlayer4: string;
  public useItemOnPlayer5: string;
  public useItemOnPlayer6: string;
  public useItemOnPlayer7: string;
  public useItemOnPlayer8: string;

  constructor(props: PlayerControlKeysProps) {
    this.id = props.id;
    this.playerId = props.playerId;
    this.moveLeft = props.moveLeft;
    this.moveRight = props.moveRight;
    this.cycleBlock = props.cycleBlock;
    this.dropPiece = props.dropPiece;
    this.useItem = props.useItem;
    this.useItemOnPlayer1 = props.useItemOnPlayer1;
    this.useItemOnPlayer2 = props.useItemOnPlayer2;
    this.useItemOnPlayer3 = props.useItemOnPlayer3;
    this.useItemOnPlayer4 = props.useItemOnPlayer4;
    this.useItemOnPlayer5 = props.useItemOnPlayer5;
    this.useItemOnPlayer6 = props.useItemOnPlayer6;
    this.useItemOnPlayer7 = props.useItemOnPlayer7;
    this.useItemOnPlayer8 = props.useItemOnPlayer8;
  }

  public toPlainObject(): PlayerControlKeysPlainObject {
    return {
      id: this.id,
      playerId: this.playerId,
      moveLeft: this.moveLeft,
      moveRight: this.moveRight,
      cycleBlock: this.cycleBlock,
      dropPiece: this.dropPiece,
      useItem: this.useItem,
      useItemOnPlayer1: this.useItemOnPlayer1,
      useItemOnPlayer2: this.useItemOnPlayer2,
      useItemOnPlayer3: this.useItemOnPlayer3,
      useItemOnPlayer4: this.useItemOnPlayer4,
      useItemOnPlayer5: this.useItemOnPlayer5,
      useItemOnPlayer6: this.useItemOnPlayer6,
      useItemOnPlayer7: this.useItemOnPlayer7,
      useItemOnPlayer8: this.useItemOnPlayer8,
    };
  }
}
