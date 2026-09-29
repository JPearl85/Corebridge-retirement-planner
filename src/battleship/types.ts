export const BOARD_SIZE = 10;

export const SHIP_SIZES = [5, 4, 3, 3, 2] as const;

export const SHIP_NAMES = ['Carrier', 'Battleship', 'Cruiser', 'Submarine', 'Destroyer'] as const;

export type Orientation = 'horizontal' | 'vertical';

export interface Coord {
  row: number;
  col: number;
}

export interface Ship {
  id: number;
  name: string;
  size: number;
  cells: Coord[];
  hits: number;
}

export interface Cell {
  shipId: number | null;
  shot: boolean;
}

export interface Board {
  grid: Cell[][];
  ships: Ship[];
}

export type GamePhase = 'setup' | 'playing' | 'gameOver';

export type ShotOutcome = 'hit' | 'miss' | 'sunk' | 'repeat';

export interface ShotResult {
  row: number;
  col: number;
  outcome: ShotOutcome;
  /** The ship that was sunk by this shot, if any. */
  ship: Ship | null;
}

export type Rng = () => number;
