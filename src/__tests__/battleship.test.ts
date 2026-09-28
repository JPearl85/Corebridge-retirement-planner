import { describe, it, expect } from 'vitest';
import { BOARD_SIZE, SHIP_SIZES } from '../battleship/types';
import type { Board } from '../battleship/types';
import { allShipsSunk, createEmptyBoard, fire, isSunk, placeShips } from '../battleship/game';
import { applyResult, createAiState, nextShot } from '../battleship/ai';

function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function firstCellOfShip(board: Board, shipId: number) {
  return board.ships[shipId].cells;
}

describe('createEmptyBoard', () => {
  it('creates a 10x10 grid with no ships or shots', () => {
    const board = createEmptyBoard();
    expect(board.grid).toHaveLength(BOARD_SIZE);
    expect(board.ships).toHaveLength(0);
    board.grid.forEach(row => {
      expect(row).toHaveLength(BOARD_SIZE);
      row.forEach(cell => {
        expect(cell.shipId).toBeNull();
        expect(cell.shot).toBe(false);
      });
    });
  });
});

describe('placeShips', () => {
  it('places every ship in bounds, straight, contiguous and without overlaps', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const board = placeShips(seededRng(seed));
      expect(board.ships.map(ship => ship.size)).toEqual([...SHIP_SIZES]);

      const occupied = new Set<string>();
      board.ships.forEach(ship => {
        expect(ship.cells).toHaveLength(ship.size);
        ship.cells.forEach(({ row, col }) => {
          expect(row).toBeGreaterThanOrEqual(0);
          expect(row).toBeLessThan(BOARD_SIZE);
          expect(col).toBeGreaterThanOrEqual(0);
          expect(col).toBeLessThan(BOARD_SIZE);
          const key = `${row},${col}`;
          expect(occupied.has(key)).toBe(false);
          occupied.add(key);
          expect(board.grid[row][col].shipId).toBe(ship.id);
        });

        const rows = new Set(ship.cells.map(c => c.row));
        const cols = new Set(ship.cells.map(c => c.col));
        const horizontal = rows.size === 1 && cols.size === ship.size;
        const vertical = cols.size === 1 && rows.size === ship.size;
        expect(horizontal || vertical).toBe(true);

        const varying = horizontal ? ship.cells.map(c => c.col) : ship.cells.map(c => c.row);
        expect(Math.max(...varying) - Math.min(...varying)).toBe(ship.size - 1);
      });

      expect(occupied.size).toBe(SHIP_SIZES.reduce((sum, size) => sum + size, 0));
    }
  });
});

describe('fire', () => {
  it('reports miss, hit, sunk and repeat outcomes', () => {
    const board = placeShips(seededRng(42));
    const cells = firstCellOfShip(board, 0);

    const emptyCell = (() => {
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (board.grid[row][col].shipId === null) return { row, col };
        }
      }
      throw new Error('no empty cell');
    })();

    const missed = fire(board, emptyCell.row, emptyCell.col);
    expect(missed.result.outcome).toBe('miss');
    expect(missed.board.grid[emptyCell.row][emptyCell.col].shot).toBe(true);
    expect(board.grid[emptyCell.row][emptyCell.col].shot).toBe(false);

    expect(fire(missed.board, emptyCell.row, emptyCell.col).result.outcome).toBe('repeat');
    expect(fire(missed.board, -1, 0).result.outcome).toBe('repeat');

    let current = missed.board;
    cells.forEach((cell, index) => {
      const shot = fire(current, cell.row, cell.col);
      current = shot.board;
      if (index < cells.length - 1) {
        expect(shot.result.outcome).toBe('hit');
        expect(shot.result.ship).toBeNull();
      } else {
        expect(shot.result.outcome).toBe('sunk');
        expect(shot.result.ship?.name).toBe(board.ships[0].name);
      }
    });

    expect(isSunk(current.ships[0])).toBe(true);
    expect(allShipsSunk(current)).toBe(false);
  });
});

describe('allShipsSunk', () => {
  it('is true only once every ship cell has been hit', () => {
    let board = placeShips(seededRng(7));
    expect(allShipsSunk(board)).toBe(false);
    board.ships.flatMap(ship => ship.cells).forEach(({ row, col }) => {
      board = fire(board, row, col).board;
    });
    expect(allShipsSunk(board)).toBe(true);
  });

  it('is false for a board without ships', () => {
    expect(allShipsSunk(createEmptyBoard())).toBe(false);
  });
});

describe('ai', () => {
  it('never repeats a shot and sinks the whole fleet within 100 shots', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = seededRng(seed);
      let board = placeShips(rng);
      let ai = createAiState();
      const seen = new Set<string>();
      let shots = 0;

      while (!allShipsSunk(board)) {
        const shot = nextShot(ai, rng);
        const key = `${shot.row},${shot.col}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);

        const fired = fire(board, shot.row, shot.col);
        expect(fired.result.outcome).not.toBe('repeat');
        board = fired.board;
        ai = applyResult(ai, shot, fired.result.outcome);
        shots++;
        expect(shots).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
      }

      expect(board.ships.every(isSunk)).toBe(true);
    }
  });

  it('targets neighbours of a hit before hunting again', () => {
    const ai = applyResult(createAiState(), { row: 4, col: 4 }, 'hit');
    expect(ai.targets).toHaveLength(4);
    const shot = nextShot(ai, () => 0);
    expect(Math.abs(shot.row - 4) + Math.abs(shot.col - 4)).toBe(1);
  });

  it('fires along the line once two hits share a row', () => {
    let ai = applyResult(createAiState(), { row: 4, col: 4 }, 'hit');
    ai = applyResult(ai, { row: 4, col: 5 }, 'hit');
    expect(ai.targets).toEqual([
      { row: 4, col: 3 },
      { row: 4, col: 6 },
    ]);
  });

  it('clears targeting state once the ship is sunk', () => {
    let ai = applyResult(createAiState(), { row: 0, col: 0 }, 'hit');
    ai = applyResult(ai, { row: 0, col: 1 }, 'sunk');
    expect(ai.hits).toHaveLength(0);
    expect(ai.targets).toHaveLength(0);
  });

  it('hunts on parity cells while no hits are unresolved', () => {
    const ai = createAiState();
    for (let i = 0; i < 20; i++) {
      const shot = nextShot(ai, seededRng(i));
      expect((shot.row + shot.col) % 2).toBe(0);
    }
  });
});
