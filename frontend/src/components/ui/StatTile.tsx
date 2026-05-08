import { ReactNode } from 'react';
import { Pill, PillKind } from './Pill';

interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  trend?: { kind: PillKind; label: string };
  /** Slot for a sparkline or other accent at the bottom of the tile. */
  accent?: ReactNode;
  className?: string;
}

/**
 * Dashboard stat tile — matches the prototype dashboard.jsx StatTile.
 * Compact card with a label, large numeric value, optional sub-label and trend pill.
 */
export function StatTile({ label, value, sub, trend, accent, className }: StatTileProps) {
  return (
    <div
      className={`card card-pad${className ? ' ' + className : ''}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {trend && (
          <Pill kind={trend.kind} dot={false}>
            {trend.label}
          </Pill>
        )}
      </div>
      <div
        className="tabular"
        style={{
          fontFamily: 'Inter Tight',
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>{sub}</div>}
      {accent}
    </div>
  );
}
