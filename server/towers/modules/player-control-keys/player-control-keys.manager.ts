import { createId } from "@paralleldrive/cuid2";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import {
  PlayerControlKeys,
  PlayerControlKeysProps,
} from "@/server/towers/modules/player-control-keys/player-control-keys.entity";

export class PlayerControlKeysManager {
  private static playerControlKeys: Map<string, PlayerControlKeys> = new Map<string, PlayerControlKeys>();

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): PlayerControlKeys | undefined {
    return this.playerControlKeys.get(id);
  }

  public static all(): PlayerControlKeys[] {
    return [...this.playerControlKeys.values()];
  }

  public static create(props: Omit<PlayerControlKeysProps, "id">): PlayerControlKeys {
    const playerControlKeys: PlayerControlKeys | undefined = new PlayerControlKeys({ id: createId(), ...props });
    this.playerControlKeys.set(playerControlKeys.id, playerControlKeys);
    return playerControlKeys;
  }

  public static async upsert(props: PlayerControlKeysProps): Promise<PlayerControlKeys> {
    const playerControlKeys: PlayerControlKeys | undefined = this.playerControlKeys.get(props.id);

    if (playerControlKeys) {
      playerControlKeys.moveLeft = props.moveLeft;
      playerControlKeys.moveRight = props.moveRight;
      playerControlKeys.cycleBlock = props.cycleBlock;
      playerControlKeys.dropPiece = props.dropPiece;
      playerControlKeys.useItem = props.useItem;
      playerControlKeys.useItemOnPlayer1 = props.useItemOnPlayer1;
      playerControlKeys.useItemOnPlayer2 = props.useItemOnPlayer2;
      playerControlKeys.useItemOnPlayer3 = props.useItemOnPlayer3;
      playerControlKeys.useItemOnPlayer4 = props.useItemOnPlayer4;
      playerControlKeys.useItemOnPlayer5 = props.useItemOnPlayer5;
      playerControlKeys.useItemOnPlayer6 = props.useItemOnPlayer6;
      playerControlKeys.useItemOnPlayer7 = props.useItemOnPlayer7;
      playerControlKeys.useItemOnPlayer8 = props.useItemOnPlayer8;

      await publishRedisEvent(ServerInternalEvents.GAME_CONTROL_KEYS_UPDATE, {
        userId: playerControlKeys.playerId,
        controlKeys: playerControlKeys.toPlainObject(),
      });

      return playerControlKeys;
    }

    return this.create(props);
  }

  public static delete(playerId: string): void {
    this.playerControlKeys.delete(playerId);
  }

  // ---------- Controls Keys Actions ------------------------------

  public static getByPlayerId(playerId: string): PlayerControlKeys {
    const controlKeys: PlayerControlKeys | undefined = this.all().find(
      (pck: PlayerControlKeys) => pck.playerId === playerId,
    );
    if (controlKeys) return controlKeys;

    const defaultKeysProps: Omit<PlayerControlKeysProps, "id"> = {
      playerId,
      moveLeft: "ArrowLeft",
      moveRight: "ArrowRight",
      cycleBlock: "ArrowUp",
      dropPiece: "ArrowDown",
      useItem: "Space",
      useItemOnPlayer1: "Digit1",
      useItemOnPlayer2: "Digit2",
      useItemOnPlayer3: "Digit3",
      useItemOnPlayer4: "Digit4",
      useItemOnPlayer5: "Digit5",
      useItemOnPlayer6: "Digit6",
      useItemOnPlayer7: "Digit7",
      useItemOnPlayer8: "Digit8",
    };

    return this.create(defaultKeysProps);
  }
}
