export const MIN_GAME_VIEWPORT_WIDTH = 1275;
export const MIN_GAME_VIEWPORT_HEIGHT = 920;

/**************************************************
 * Room
 **************************************************/

export const ROOM_MAX_USERS_CAPACITY = 300;
export const CHAT_MESSSAGE_MAX_LENGTH = 300;

/**************************************************
 * Table
 **************************************************/

export const NUM_TABLE_SEATS = 8;

/**************************************************
 * Game
 **************************************************/

export const MIN_ACTIVE_TEAMS_REQUIRED = 2;
export const MIN_ACTIVE_TEAMS_REQUIRED_TEST = 1;
export const COUNTDOWN_START_NUMBER = 15;
export const COUNTDOWN_START_NUMBER_TEST = 3;
export const MIN_GRACE_PERIOD_SECONDS = 15;
export const BOARD_CELL_SIZE = 30;
export const BOARD_CELL_SIZE_OPPONENT = 15;
export const BOARD_ROWS = 16;
export const BOARD_COLS = 6;
export const HIDDEN_ROWS_COUNT = 3;
export const PIECE_LENGTH = 3;
export const PIECE_STARTING_ROW = 0;
export const PIECE_STARTING_COL = 2;
export const EMPTY_CELL = " ";
export const NUM_NEXT_PIECES = 10;
export const MIN_MATCHING_BLOCKS = 3;
export const HOO_SEQUENCE = "YOUPI!";
export const POWER_BAR_LENGTH = 8;
export const REMOVED_BLOCKS_COUNT_FOR_SPEED_DROP = 50;
export const REMOVED_BLOCKS_COUNT_FOR_REMOVE_POWERS = 100;
export const REMOVED_BLOCKS_COUNT_FOR_REMOVE_STONES = 150;
export const BLOCK_BREAK_ANIMATION_DURATION_MS = 190;
export const HERO_CODE_ELIGIBILITY_TIME = 2 * 60 * 60 * 1000; // 2 hours
export const HERO_CODE_REQUIRED_WINS = 25;

export const MATCH_DIRECTIONS = [
  { row: -1, col: 0 }, // Up
  { row: 1, col: 0 }, // Down
  { row: 0, col: -1 }, // Left
  { row: 0, col: 1 }, // Right
  { row: -1, col: -1 }, // Top-left
  { row: -1, col: 1 }, // Top-right
  { row: 1, col: -1 }, // Bottom-left
  { row: 1, col: 1 }, // Bottom-right
];

export const HOO_DIRECTIONS = [
  { row: 0, col: 1 }, // →
  { row: 1, col: 0 }, // ↓
  { row: 1, col: 1 }, // ↘
  { row: -1, col: 1 }, // ↗
];

/**************************************************
 * Game Ratings
 **************************************************/

export const RATING_MASTER = 2100; // 2100+
export const RATING_DIAMOND = 1800; // 1800 - 2099
export const RATING_PLATINUM = 1500; // 1500 - 1799
export const RATING_GOLD = 1200; // 1200 - 1499
export const RATING_SILVER = 0; // minimum - 1199
export const PROVISIONAL_MAX_COMPLETED_GAMES = 20;

/**************************************************
 * Conversation
 **************************************************/

export const INSTANT_MESSAGE_MAX_LENGTH = 500;
