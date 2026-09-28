import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_SIZE } from './types';
import type { Board, GamePhase, ShotResult } from './types';
import { allShipsSunk, fire, placeShips } from './game';
import { applyResult, createAiState, nextShot } from './ai';
import type { AiState } from './ai';

const AI_DELAY_MS = 700;
const COLUMN_LABELS = 'ABCDEFGHIJ'.split('');

interface GameState {
  playerBoard: Board;
  enemyBoard: Board;
  ai: AiState;
  phase: GamePhase;
  turn: 'player' | 'ai';
  message: string;
  playerSunk: string[];
  enemySunk: string[];
}

function newGame(): GameState {
  return {
    playerBoard: placeShips(),
    enemyBoard: placeShips(),
    ai: createAiState(),
    phase: 'playing',
    turn: 'player',
    message: 'Your turn — pick a target on the enemy waters.',
    playerSunk: [],
    enemySunk: [],
  };
}

const coordLabel = (row: number, col: number) => `${COLUMN_LABELS[col]}${row + 1}`;

function describe(result: ShotResult, who: 'You' | 'Enemy'): string {
  const where = coordLabel(result.row, result.col);
  if (result.outcome === 'sunk') return `${who} sank the ${result.ship?.name} at ${where}.`;
  if (result.outcome === 'hit') return `${who} hit a ship at ${where}.`;
  return `${who} missed at ${where}.`;
}

interface GridProps {
  board: Board;
  revealShips: boolean;
  onFire?: (row: number, col: number) => void;
  disabled?: boolean;
  label: string;
}

const Grid: React.FC<GridProps> = ({ board, revealShips, onFire, disabled, label }) => (
  <div className="bs-board">
    <div className="bs-board-title">{label}</div>
    <div className="bs-grid" role="grid" aria-label={label}>
      <div className="bs-corner" />
      {COLUMN_LABELS.map(col => (
        <div key={`c-${col}`} className="bs-axis">{col}</div>
      ))}
      {board.grid.map((cells, row) => (
        <React.Fragment key={`r-${row}`}>
          <div className="bs-axis">{row + 1}</div>
          {cells.map((cell, col) => {
            const hit = cell.shot && cell.shipId !== null;
            const miss = cell.shot && cell.shipId === null;
            const ship = revealShips && cell.shipId !== null;
            const classes = [
              'bs-cell',
              ship ? 'ship' : '',
              hit ? 'hit' : '',
              miss ? 'miss' : '',
            ].filter(Boolean).join(' ');
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                className={classes}
                disabled={disabled || !onFire || cell.shot}
                onClick={onFire ? () => onFire(row, col) : undefined}
                aria-label={`${label} ${coordLabel(row, col)}${hit ? ' hit' : miss ? ' miss' : ''}`}
              >
                {hit ? '✕' : miss ? '•' : ''}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const BattleshipGame: React.FC = () => {
  const [game, setGame] = useState<GameState>(newGame);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const runAiTurn = useCallback(() => {
    setGame(prev => {
      if (prev.phase !== 'playing' || prev.turn !== 'ai') return prev;
      const shot = nextShot(prev.ai);
      const { board, result } = fire(prev.playerBoard, shot.row, shot.col);
      const ai = applyResult(prev.ai, shot, result.outcome);
      const playerSunk = result.outcome === 'sunk' && result.ship
        ? [...prev.playerSunk, result.ship.name]
        : prev.playerSunk;
      const lost = allShipsSunk(board);
      return {
        ...prev,
        playerBoard: board,
        ai,
        playerSunk,
        phase: lost ? 'gameOver' : 'playing',
        turn: 'player',
        message: lost ? 'The enemy sank your entire fleet. You lose.' : describe(result, 'Enemy'),
      };
    });
  }, []);

  useEffect(() => {
    if (game.phase !== 'playing' || game.turn !== 'ai') return;
    timerRef.current = setTimeout(runAiTurn, AI_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [game.phase, game.turn, runAiTurn]);

  const handlePlayerFire = (row: number, col: number) => {
    setGame(prev => {
      if (prev.phase !== 'playing' || prev.turn !== 'player') return prev;
      const { board, result } = fire(prev.enemyBoard, row, col);
      if (result.outcome === 'repeat') return prev;
      const enemySunk = result.outcome === 'sunk' && result.ship
        ? [...prev.enemySunk, result.ship.name]
        : prev.enemySunk;
      const won = allShipsSunk(board);
      return {
        ...prev,
        enemyBoard: board,
        enemySunk,
        phase: won ? 'gameOver' : 'playing',
        turn: won ? 'player' : 'ai',
        message: won ? 'You sank the entire enemy fleet. You win!' : describe(result, 'You'),
      };
    });
  };

  const restart = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setGame(newGame());
  };

  const remaining = (board: Board) => board.ships.filter(ship => ship.hits < ship.size).length;

  return (
    <div className="main">
      <div className="bs-header">
        <div>
          <div className="section-label">Coffee break</div>
          <div className="bs-title">Battleship</div>
        </div>
        <button type="button" className="bs-restart" onClick={restart}>Restart</button>
      </div>

      <div className="chart-card bs-status">
        <div className="bs-message">{game.message}</div>
        <div className="bs-counts">
          <span>Your ships afloat: <strong>{remaining(game.playerBoard)}</strong> / {game.playerBoard.ships.length}</span>
          <span>Enemy ships afloat: <strong>{remaining(game.enemyBoard)}</strong> / {game.enemyBoard.ships.length}</span>
        </div>
        {game.phase === 'gameOver' && <div className="bs-gameover">Game over — {game.message}</div>}
      </div>

      <div className="bs-boards">
        <div className="chart-card">
          <Grid board={game.playerBoard} revealShips label="Your fleet" />
          <div className="bs-sunk">Lost: {game.playerSunk.length > 0 ? game.playerSunk.join(', ') : 'none'}</div>
        </div>
        <div className="chart-card">
          <Grid
            board={game.enemyBoard}
            revealShips={game.phase === 'gameOver'}
            onFire={handlePlayerFire}
            disabled={game.phase !== 'playing' || game.turn !== 'player'}
            label="Enemy waters"
          />
          <div className="bs-sunk">Sunk: {game.enemySunk.length > 0 ? game.enemySunk.join(', ') : 'none'}</div>
        </div>
      </div>
      <div className="privacy-note">{BOARD_SIZE}×{BOARD_SIZE} grid · ships of size 5, 4, 3, 3 and 2.</div>
    </div>
  );
};

export default BattleshipGame;
