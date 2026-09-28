import { BOARD_SIZE, SHIP_NAMES, SHIP_SIZES } from './types';
import type { Board, Cell, Coord, Orientation, Rng, ShotResult, Ship } from './types';

export function createEmptyBoard(): Board {
  const grid: Cell[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({ shipId: null, shot: false })),
  );
  return { grid, ships: [] };
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function shipCells(row: number, col: number, size: number, orientation: Orientation): Coord[] {
  return Array.from({ length: size }, (_, i) =>
    orientation === 'horizontal' ? { row, col: col + i } : { row: row + i, col },
  );
}

function canPlace(board: Board, cells: Coord[]): boolean {
  return cells.every(({ row, col }) => inBounds(row, col) && board.grid[row][col].shipId === null);
}

export function placeShips(rng: Rng = Math.random): Board {
  const board = createEmptyBoard();

  SHIP_SIZES.forEach((size, index) => {
    const cells = ((): Coord[] => {
      for (;;) {
        const orientation: Orientation = rng() < 0.5 ? 'horizontal' : 'vertical';
        const maxRow = orientation === 'vertical' ? BOARD_SIZE - size : BOARD_SIZE - 1;
        const maxCol = orientation === 'horizontal' ? BOARD_SIZE - size : BOARD_SIZE - 1;
        const row = Math.floor(rng() * (maxRow + 1));
        const col = Math.floor(rng() * (maxCol + 1));
        const candidate = shipCells(row, col, size, orientation);
        if (canPlace(board, candidate)) return candidate;
      }
    })();

    const ship: Ship = { id: index, name: SHIP_NAMES[index], size, cells, hits: 0 };
    board.ships.push(ship);
    cells.forEach(({ row, col }) => {
      board.grid[row][col].shipId = ship.id;
    });
  });

  return board;
}

export function cloneBoard(board: Board): Board {
  return {
    grid: board.grid.map(row => row.map(cell => ({ ...cell }))),
    ships: board.ships.map(ship => ({ ...ship, cells: ship.cells.map(cell => ({ ...cell })) })),
  };
}

export function isSunk(ship: Ship): boolean {
  return ship.hits >= ship.size;
}

export function allShipsSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

/** Fires at a cell and returns the resulting board alongside the outcome. Does not mutate `board`. */
export function fire(board: Board, row: number, col: number): { board: Board; result: ShotResult } {
  if (!inBounds(row, col) || board.grid[row][col].shot) {
    return { board, result: { row, col, outcome: 'repeat', ship: null } };
  }

  const next = cloneBoard(board);
  const cell = next.grid[row][col];
  cell.shot = true;

  if (cell.shipId === null) {
    return { board: next, result: { row, col, outcome: 'miss', ship: null } };
  }

  const ship = next.ships[cell.shipId];
  ship.hits += 1;
  const outcome = isSunk(ship) ? 'sunk' : 'hit';
  return { board: next, result: { row, col, outcome, ship: outcome === 'sunk' ? ship : null } };
}
