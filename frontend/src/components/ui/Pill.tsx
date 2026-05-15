import { ReactNode } from 'react';

export type PillKind = 'ok' | 'warn' | 'err' | 'info' | 'mute';

interface PillProps {
  kind?: PillKind;
  /** Hide the leading colored dot. Defaults to true (dot shown). */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Status pill — wraps the .pill / .pill-{kind} classes from verdant.css.
 * Use for run status, project health, "live" indicator, etc.
 */
export function Pill({ kind = 'mute', dot = true, className, children }: PillProps) {
  return (
    <span className={`pill pill-${kind}${className ? ' ' + className : ''}`}>
      {dot && <span className="dot"></span>}
      {children}
    </span>
  );
}
