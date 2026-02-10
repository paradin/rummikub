
export enum TileColor {
  Red = 'Red',
  Blue = 'Blue',
  Orange = 'Orange',
  Black = 'Black',
  Joker = 'Joker'
}

export interface Tile {
  id: string;
  number: number; // 1-13
  color: TileColor;
  isJoker: boolean;
}

export type TileSet = Tile[];

export interface GameState {
  board: TileSet[];
  playerHand: Tile[];
  aiHands: Tile[][];
  pool: Tile[];
  currentPlayerIndex: number;
  hasMeld: boolean[]; // Whether each player has completed their initial 30-point meld
  winner: number | null;
  message: string;
}

export enum PlayerType {
  Human = 0,
  AI1 = 1,
  AI2 = 2,
  AI3 = 3
}
