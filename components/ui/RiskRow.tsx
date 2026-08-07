import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from './Badge';

type Props = {
  name: ReactNode;
  note?: ReactNode;
  amount?: ReactNode;
  badge?: ReactNode;
  badgeTone?: BadgeTone;
  diffTag?: ReactNode;
};

export function RiskRow({
  name,
  note,
  amount,
  badge,
  badgeTone = 'neutral',
  diffTag,
}: Props) {
  return (
    <div className="risk-row">
      <div>
        <div className="risk-name">{name}</div>
        {note ? <div className="risk-note">{note}</div> : null}
        {diffTag ? <span className="diff-tag">{diffTag}</span> : null}
      </div>
      <div style={{ textAlign: 'right' }}>
        {amount != null ? <span className="risk-amt">{amount}</span> : null}
        {badge != null ? <Badge tone={badgeTone}>{badge}</Badge> : null}
      </div>
    </div>
  );
}
