import React from 'react';
import type { ProjectionRow } from '../types';

interface ComparePlanOption {
  id: string;
  name: string;
}

interface CompareViewProps {
  activePlanName: string;
  rows: ProjectionRow[];
  comparePlanId: string | null;
  comparePlanName: string | null;
  compareRows: ProjectionRow[] | null;
  compareOptions: ComparePlanOption[];
  onComparePlanChange: (planId: string | null) => void;
}

const fmt = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1000) return sign + '$' + Math.round(abs / 1000) + 'K';
  return sign + '$' + Math.round(abs);
};

const pct = (n: number): string => (n * 100).toFixed(1) + '%';

const BLANK = '—';

const CompareView: React.FC<CompareViewProps> = ({
  activePlanName,
  rows,
  comparePlanId,
  comparePlanName,
  compareRows,
  compareOptions,
  onComparePlanChange,
}) => {
  const baseRows = rows.slice(1);
  const otherRows = (compareRows ?? []).slice(1);
  const baseByAge = new Map(baseRows.map(r => [r.age, r]));
  const otherByAge = new Map(otherRows.map(r => [r.age, r]));
  const ages = Array.from(new Set([...baseByAge.keys(), ...otherByAge.keys()])).sort((x, y) => x - y);

  const picker = (
    <div className="compare-picker" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 1rem' }}>
      <label htmlFor="compare-plan-select" className="detail-label">Compare with</label>
      <select
        id="compare-plan-select"
        value={comparePlanId ?? ''}
        onChange={(e) => onComparePlanChange(e.target.value || null)}
      >
        <option value="">Select a plan…</option>
        {compareOptions.map(option => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="chart-card">
      <div className="chart-title">Plan comparison</div>
      {picker}
      {compareOptions.length === 0 ? (
        <div className="note">Create or import a second plan to compare against “{activePlanName}”.</div>
      ) : !compareRows ? (
        <div className="note">Select a plan to compare against “{activePlanName}”.</div>
      ) : (
        <div className="optimizer-table-wrap">
          <table className="optimizer-table opt-schedule-table">
            <thead>
              <tr>
                <th>Age</th>
                <th>{activePlanName}: Total</th>
                <th>{comparePlanName}: Total</th>
                <th>Δ Total</th>
                <th>{activePlanName}: Portfolio</th>
                <th>{comparePlanName}: Portfolio</th>
                <th>{activePlanName}: Tax</th>
                <th>{comparePlanName}: Tax</th>
                <th>{activePlanName}: Marginal</th>
                <th>{comparePlanName}: Marginal</th>
                <th>{activePlanName}: Spending</th>
                <th>{comparePlanName}: Spending</th>
              </tr>
            </thead>
            <tbody>
              {ages.map(age => {
                const a = baseByAge.get(age);
                const b = otherByAge.get(age);
                const delta = a && b ? b.total - a.total : null;
                return (
                  <tr key={age}>
                    <td>{age}</td>
                    <td>{a ? fmt(a.total) : BLANK}</td>
                    <td>{b ? fmt(b.total) : BLANK}</td>
                    <td>{delta === null ? BLANK : (delta >= 0 ? '+' : '') + fmt(delta)}</td>
                    <td>{a ? fmt(a.portfolioValue) : BLANK}</td>
                    <td>{b ? fmt(b.portfolioValue) : BLANK}</td>
                    <td>{a ? fmt(a.totalTax) : BLANK}</td>
                    <td>{b ? fmt(b.totalTax) : BLANK}</td>
                    <td>{a ? pct(a.marginalRate) : BLANK}</td>
                    <td>{b ? pct(b.marginalRate) : BLANK}</td>
                    <td>{a ? fmt(a.totalSpending) : BLANK}</td>
                    <td>{b ? fmt(b.totalSpending) : BLANK}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompareView;
