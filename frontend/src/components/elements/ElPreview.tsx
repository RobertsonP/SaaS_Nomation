/**
 * Mini visual preview chip for element library entries.
 * Mirrors `pages.jsx:4–9` from the Verdant prototype: a hairlined surface
 * square with a type-specific child (button / input / link / generic dim).
 *
 * Sizing:
 *  - Default: 72px tall, used in the test-builder element library cards.
 *  - `compact`: 52px tall, used in the project Elements tab table column
 *    where horizontal space is tight.
 */
interface ElPreviewProps {
  type: string;
  label?: string;
  compact?: boolean;
}

export function ElPreview({ type, label, compact }: ElPreviewProps) {
  const className = compact ? 'el-preview el-preview-compact' : 'el-preview';
  // Allow more text in the larger default variant since the chip can absorb it.
  const btnMax = compact ? 22 : 28;
  const linkMax = compact ? 28 : 36;

  if (type === 'button') {
    const text = label ? truncate(label, btnMax) : 'Button';
    return (
      <div className={className}>
        <div className="el-preview-btn">{text}</div>
      </div>
    );
  }
  if (type === 'input') {
    return (
      <div className={className}>
        <div className="el-preview-input" />
      </div>
    );
  }
  if (type === 'link') {
    const text = label ? truncate(label, linkMax) : 'Link';
    return (
      <div className={className}>
        <span className="el-preview-link">{text}</span>
      </div>
    );
  }
  return (
    <div className={className}>
      <span className="dim mono" style={{ fontSize: compact ? 10.5 : 12 }}>
        {type}
      </span>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
