import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_SIZE } from './types';
import type { Board, GamePhase, ShotResult } from './types';
import { allShipsSunk, fire, placeShips } from './game';
import { applyResult, createAiState, nextShot } from './ai';
import type { AiState } from './ai';
import { outcomeSound, playSound } from './sound';
import type { SoundName } from './sound';
import { CLAUDE, DEVIN } from './teams';
import TeamBadge from './TeamBadge';

const AI_DELAY_MS = 700;
const IMPACT_DELAY_MS = 190;
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
    message: `${DEVIN.name} to fire — pick a target in ${CLAUDE.name} waters.`,
    playerSunk: [],
    enemySunk: [],
  };
}

const coordLabel = (row: number, col: number) => `${COLUMN_LABELS[col]}${row + 1}`;

function describe(result: ShotResult, who: string, target: string): string {
  const where = coordLabel(result.row, result.col);
  if (result.outcome === 'sunk') return `${who} sank the ${target} ${result.ship?.name} at ${where}.`;
  if (result.outcome === 'hit') return `${who} hit a ${target} ship at ${where}.`;
  return `${who} missed at ${where}.`;
}

interface GridProps {
  board: Board;
  revealShips: boolean;
  onFire?: (row: number, col: number) => void;
  disabled?: boolean;
  label: string;
  team: 'devin' | 'claude';
}

const Grid: React.FC<GridProps> = ({ board, revealShips, onFire, disabled, label, team }) => (
  <div className={`bs-board bs-fleet-${team}`}>
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
  const [muted, setMuted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(game);
  const mutedRef = useRef(muted);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
  }, []);

  const play = useCallback((name: SoundName | null) => {
    if (!name || mutedRef.current) return;
    playSound(name);
  }, []);

  const playShot = useCallback((result: ShotResult, finale: SoundName | null) => {
    play('fire');
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    soundTimerRef.current = setTimeout(() => {
      play(outcomeSound(result.outcome));
      if (finale) setTimeout(() => play(finale), 450);
    }, IMPACT_DELAY_MS);
  }, [play]);

  const runAiTurn = useCallback(() => {
    const prev = gameRef.current;
    if (prev.phase !== 'playing' || prev.turn !== 'ai') return;
    const shot = nextShot(prev.ai);
    const { board, result } = fire(prev.playerBoard, shot.row, shot.col);
    const ai = applyResult(prev.ai, shot, result.outcome);
    const playerSunk = result.outcome === 'sunk' && result.ship
      ? [...prev.playerSunk, result.ship.name]
      : prev.playerSunk;
    const lost = allShipsSunk(board);
    playShot(result, lost ? 'lose' : null);
    setGame({
      ...prev,
      playerBoard: board,
      ai,
      playerSunk,
      phase: lost ? 'gameOver' : 'playing',
      turn: 'player',
      message: lost
        ? `${CLAUDE.name} sank the whole ${DEVIN.name} fleet. ${CLAUDE.name} wins.`
        : describe(result, CLAUDE.name, DEVIN.name),
    });
  }, [playShot]);

  useEffect(() => {
    if (game.phase !== 'playing' || game.turn !== 'ai') return;
    timerRef.current = setTimeout(runAiTurn, AI_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [game.phase, game.turn, runAiTurn]);

  const handlePlayerFire = (row: number, col: number) => {
    const prev = gameRef.current;
    if (prev.phase !== 'playing' || prev.turn !== 'player') return;
    const { board, result } = fire(prev.enemyBoard, row, col);
    if (result.outcome === 'repeat') return;
    const enemySunk = result.outcome === 'sunk' && result.ship
      ? [...prev.enemySunk, result.ship.name]
      : prev.enemySunk;
    const won = allShipsSunk(board);
    playShot(result, won ? 'win' : null);
    setGame({
      ...prev,
      enemyBoard: board,
      enemySunk,
      phase: won ? 'gameOver' : 'playing',
      turn: won ? 'player' : 'ai',
      message: won
        ? `${DEVIN.name} sank the whole ${CLAUDE.name} fleet. ${DEVIN.name} wins!`
        : describe(result, DEVIN.name, CLAUDE.name),
    });
  };

  const restart = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    setGame(newGame());
  };

  const remaining = (board: Board) => board.ships.filter(ship => ship.hits < ship.size).length;

  return (
    <div className="main">
      <div className="bs-header">
        <div>
          <div className="section-label">Coffee break</div>
          <div className="bs-title">Battleship</div>
          <div className="bs-matchup">
            <TeamBadge team={DEVIN} />
            <span className="bs-versus">vs</span>
            <TeamBadge team={CLAUDE} />
          </div>
        </div>
        <div className="bs-actions">
          <button
            type="button"
            className={`bs-mute ${muted ? 'muted' : ''}`}
            onClick={() => setMuted(m => !m)}
            aria-pressed={muted}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <button type="button" className="bs-restart" onClick={restart}>Restart</button>
        </div>
      </div>

      <div className="chart-card bs-status">
        <div className="bs-message">{game.message}</div>
        <div className="bs-counts">
          <span className="bs-count-devin">{DEVIN.name} afloat: <strong>{remaining(game.playerBoard)}</strong> / {game.playerBoard.ships.length}</span>
          <span className="bs-count-claude">{CLAUDE.name} afloat: <strong>{remaining(game.enemyBoard)}</strong> / {game.enemyBoard.ships.length}</span>
        </div>
        {game.phase === 'gameOver' && <div className="bs-gameover">Game over — {game.message}</div>}
      </div>

      <div className="bs-boards">
        <div className="chart-card bs-card-devin">
          <div className="bs-board-header"><TeamBadge team={DEVIN} /><span className="bs-board-sub">your fleet</span></div>
          <Grid board={game.playerBoard} revealShips label={`${DEVIN.name} waters`} team="devin" />
          <div className="bs-sunk">Lost: {game.playerSunk.length > 0 ? game.playerSunk.join(', ') : 'none'}</div>
        </div>
        <div className="chart-card bs-card-claude">
          <div className="bs-board-header"><TeamBadge team={CLAUDE} /><span className="bs-board-sub">enemy fleet</span></div>
          <Grid
            board={game.enemyBoard}
            revealShips={game.phase === 'gameOver'}
            onFire={handlePlayerFire}
            disabled={game.phase !== 'playing' || game.turn !== 'player'}
            label={`${CLAUDE.name} waters`}
            team="claude"
          />
          <div className="bs-sunk">Sunk: {game.enemySunk.length > 0 ? game.enemySunk.join(', ') : 'none'}</div>
        </div>
      </div>
      <div className="privacy-note">{BOARD_SIZE}×{BOARD_SIZE} grid · ships of size 5, 4, 3, 3 and 2.</div>
    </div>
  );
};

export default BattleshipGame;
