/**
 * Mini visual preview chip for element library entries.
 * Mirrors `pages.jsx:4–9` from the Verdant prototype: a hairlined surface
 * square with a type-specific child (button / input / link / generic dim).
 */
interface ElPreviewProps {
  type: string;
  label?: string;
}

export function ElPreview({ type, label }: ElPreviewProps) {
  if (type === 'button') {
    const text = label ? truncate(label, 22) : 'Button';
    return (
      <div className="el-preview">
        <div className="el-preview-btn">{text}</div>
      </div>
    );
  }
  if (type === 'input') {
    return (
      <div className="el-preview">
        <div className="el-preview-input" />
      </div>
    );
  }
  if (type === 'link') {
    const text = label ? truncate(label, 28) : 'Link';
    return (
      <div className="el-preview">
        <span className="el-preview-link">{text}</span>
      </div>
    );
  }
  return (
    <div className="el-preview">
      <span className="dim mono" style={{ fontSize: 10.5 }}>
        {type}
      </span>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
