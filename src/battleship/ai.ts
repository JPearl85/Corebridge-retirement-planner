import { BOARD_SIZE } from './types';
import type { Coord, Rng, ShotOutcome } from './types';
import { inBounds } from './game';

export interface AiState {
  /** Cells the AI has already fired at. */
  fired: boolean[][];
  /** Pending candidate cells to fire at, highest priority first. */
  targets: Coord[];
  /** Hits on the ship currently being hunted down. */
  hits: Coord[];
}

export function createAiState(): AiState {
  return {
    fired: Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => false)),
    targets: [],
    hits: [],
  };
}

function cloneAiState(state: AiState): AiState {
  return {
    fired: state.fired.map(row => [...row]),
    targets: state.targets.map(coord => ({ ...coord })),
    hits: state.hits.map(coord => ({ ...coord })),
  };
}

const available = (state: AiState, { row, col }: Coord): boolean =>
  inBounds(row, col) && !state.fired[row][col];

function neighbors({ row, col }: Coord): Coord[] {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
}

/** Candidate cells extending the line formed by two or more collinear hits. */
function lineTargets(hits: Coord[]): Coord[] {
  if (hits.length < 2) return [];
  const rows = hits.map(h => h.row);
  const cols = hits.map(h => h.col);

  if (rows.every(row => row === rows[0])) {
    const row = rows[0];
    return [
      { row, col: Math.min(...cols) - 1 },
      { row, col: Math.max(...cols) + 1 },
    ];
  }
  if (cols.every(col => col === cols[0])) {
    const col = cols[0];
    return [
      { row: Math.min(...rows) - 1, col },
      { row: Math.max(...rows) + 1, col },
    ];
  }
  return [];
}

function rebuildTargets(state: AiState): Coord[] {
  const line = lineTargets(state.hits).filter(coord => available(state, coord));
  if (line.length > 0) return line;
  return state.hits
    .flatMap(neighbors)
    .filter(coord => available(state, coord))
    .filter((coord, index, all) => all.findIndex(c => c.row === coord.row && c.col === coord.col) === index);
}

/** Picks the AI's next shot: targeted when a ship is partially hit, otherwise a parity-based random hunt. */
export function nextShot(state: AiState, rng: Rng = Math.random): Coord {
  const targets = state.targets.filter(coord => available(state, coord));
  if (targets.length > 0) return targets[0];

  const unfired: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!state.fired[row][col]) unfired.push({ row, col });
    }
  }
  if (unfired.length === 0) throw new Error('No cells left to fire at');

  const parity = unfired.filter(({ row, col }) => (row + col) % 2 === 0);
  const pool = parity.length > 0 ? parity : unfired;
  return pool[Math.floor(rng() * pool.length)];
}

/** Records the outcome of the AI's shot and returns the updated state. Does not mutate `state`. */
export function applyResult(state: AiState, coord: Coord, outcome: ShotOutcome): AiState {
  const next = cloneAiState(state);
  next.fired[coord.row][coord.col] = true;

  if (outcome === 'sunk') {
    next.hits = [];
    next.targets = [];
    return next;
  }
  if (outcome === 'hit') {
    next.hits.push({ ...coord });
  }

  next.targets = rebuildTargets(next);
  return next;
}
