import type { ReactNode } from 'react';

export type BadgeTone = 'ok' | 'warn' | 'mid' | 'neutral';

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: 'badge-ok',
  warn: 'badge-warn',
  mid: 'badge-mid',
  neutral: 'badge-neutral',
};

type Props = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = 'neutral', children, className }: Props) {
  return (
    <span className={`badge ${TONE_CLASS[tone]}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
