import React from 'react';
import { CLAUDE, DEVIN } from './teams';
import type { Team } from './teams';

const DevinMark: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill={DEVIN.color} />
    <path
      d="M9 6.5h3.2a5.5 5.5 0 0 1 0 11H9z"
      fill="none"
      stroke="#F4F8FF"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
  </svg>
);

const ClaudeMark: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <g stroke={CLAUDE.color} strokeWidth="2.1" strokeLinecap="round">
      {[0, 30, 60, 90, 120, 150].map(angle => {
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad) * 8;
        const dy = Math.sin(rad) * 8;
        return <line key={angle} x1={12 - dx} y1={12 - dy} x2={12 + dx} y2={12 + dy} />;
      })}
    </g>
  </svg>
);

const TeamBadge: React.FC<{ team: Team }> = ({ team }) => (
  <span className={`bs-team bs-team-${team.id}`}>
    {team.id === 'devin' ? <DevinMark /> : <ClaudeMark />}
    <span className="bs-team-name">{team.name}</span>
    <span className="bs-team-role">{team.role}</span>
  </span>
);

export default TeamBadge;
