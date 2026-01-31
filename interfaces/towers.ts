import { EMPTY_CELL } from "@/constants/game";
import { BoardBlockPlainObject } from "@/server/towers/game/board/board";
import { PieceBlockPlainObject, PowerPieceBlockPlainObject } from "@/server/towers/game/pieces/piece-block";
import { SpecialDiamondPlainObject } from "@/server/towers/game/pieces/special-diamond/special-diamond";
import { TowersPieceBlockPlainObject } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { PowerBarPlainObject } from "@/server/towers/game/power-bar";

// Base Types
export type BlockLetter = "Y" | "O" | "U" | "P" | "I" | "!" | "ME" | "MI" | "SD" | typeof EMPTY_CELL;
export type TowersLetter = Exclude<BlockLetter, "ME" | "MI" | "SD" | typeof EMPTY_CELL>;

// Power-related Types
export type PowerType = "attack" | "defense" | undefined;
export type PowerLevel = "minor" | "normal" | "mega" | "berserk" | undefined;
export type SpecialDiamondType = "speed drop" | "remove powers" | "remove stones";

// Core Block Types
export type BoardBlock = BoardBlockPlainObject;
export type PieceBlock = PieceBlockPlainObject;
export type TowersPieceBlock = TowersPieceBlockPlainObject;
export type MedusaPieceBlock = PowerPieceBlockPlainObject;
export type MidasPieceBlock = PowerPieceBlockPlainObject;
export type PowerPieceBlock = PowerPieceBlockPlainObject;
export type SpecialDiamond = SpecialDiamondPlainObject;

// Combined Block Types
export type NextPieceBlock = PieceBlock | PowerPieceBlock;
export type PowerBarItem = PieceBlock | SpecialDiamond;
export type Block = PieceBlock | PowerPieceBlock | PowerBarItem | typeof EMPTY_CELL;

// Structures
export type BoardRow = BoardBlock[];
export type Board = BoardRow[];
export type Piece = PieceBlock[];
export type NextPieces = NextPieceBlock[];
export type PowerBar = PowerBarItem[];
export type Powers = { [key in TowersLetter]: PowerBarPlainObject };
