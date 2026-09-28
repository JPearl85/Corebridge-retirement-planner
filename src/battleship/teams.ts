export interface Team {
  id: 'devin' | 'claude';
  name: string;
  role: 'Home' | 'Guest';
  color: string;
}

export const DEVIN: Team = { id: 'devin', name: 'Devin', role: 'Home', color: '#2F7DF6' };
export const CLAUDE: Team = { id: 'claude', name: 'Claude Code', role: 'Guest', color: '#D97757' };
