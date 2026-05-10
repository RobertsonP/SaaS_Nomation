import { Lock, CheckCircle2, AlertCircle, Globe, Minus } from 'lucide-react';

export function SiteMapLegend() {
  const items: Array<{
    Icon: typeof Lock;
    label: string;
    bg: string;
    edge: string;
    fg: string;
    dashed?: boolean;
  }> = [
    {
      Icon: CheckCircle2,
      label: 'Verified',
      bg: 'var(--moss-soft)',
      edge: 'var(--moss-edge)',
      fg: 'var(--moss)',
    },
    {
      Icon: AlertCircle,
      label: 'Analyzed',
      bg: 'var(--info-soft)',
      edge: 'var(--info-edge)',
      fg: 'var(--info)',
    },
    {
      Icon: Lock,
      label: 'Auth required',
      bg: 'var(--amber-soft)',
      edge: 'var(--amber-edge)',
      fg: 'var(--amber)',
    },
    {
      Icon: Globe,
      label: 'Discovered',
      bg: 'var(--surface-2)',
      edge: 'var(--hair)',
      fg: 'var(--ink-3)',
      dashed: true,
    },
  ];

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-1)',
        padding: '8px 12px',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          fontFamily: 'Inter Tight',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--ink)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}
      >
        Legend
      </div>
      <div className="col" style={{ gap: 5 }}>
        {items.map((item) => (
          <div key={item.label} className="row" style={{ alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: `1.5px ${item.dashed ? 'dashed' : 'solid'} ${item.edge}`,
                background: item.bg,
                color: item.fg,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <item.Icon size={11} />
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div
        className="row"
        style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid var(--hair)',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--ink-3)',
        }}
      >
        <Minus size={13} />
        <span>Link between pages</span>
      </div>
    </div>
  );
}

export default SiteMapLegend;
