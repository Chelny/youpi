import { TowersPlayerControlKeys } from "db/client";
import { PlayerControlKeys } from "@/server/towers/modules/player-control-keys/player-control-keys.entity";

export class PlayerControlKeysFactory {
  public static createPlayerControlKeys(dbPlayerControlKeys: TowersPlayerControlKeys): PlayerControlKeys {
    return new PlayerControlKeys(dbPlayerControlKeys);
  }
}
