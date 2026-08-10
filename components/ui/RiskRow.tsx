'use client';

import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from './Badge';
import { RichNote } from './RichNote';

type Props = {
  name: ReactNode;
  note?: ReactNode;
  amount?: ReactNode;
  badge?: ReactNode;
  badgeTone?: BadgeTone;
  diffTag?: ReactNode;
  /** diff-tag 색: ok=초록, warn=붉은 계열 */
  diffTone?: 'ok' | 'warn';
};

export function RiskRow({
  name,
  note,
  amount,
  badge,
  badgeTone = 'neutral',
  diffTag,
  diffTone = 'warn',
}: Props) {
  let noteNode: ReactNode = null;
  if (typeof note === 'string' && note.length > 0) {
    noteNode = <RichNote text={note} />;
  } else if (note != null && note !== false) {
    noteNode = note;
  }

  return (
    <div className="risk-row">
      <div className="risk-main">
        <div className="risk-label-row">
          <div className="risk-name">{name}</div>
          {badge != null ? (
            <Badge tone={badgeTone} className="badge-pill">
              {badge}
            </Badge>
          ) : null}
        </div>
        {noteNode ? <div className="risk-note">{noteNode}</div> : null}
        {diffTag ? (
          <span className={`diff-tag diff-tag-${diffTone}`}>{diffTag}</span>
        ) : null}
      </div>
      {amount != null ? (
        <div className="risk-side">
          <span className="risk-amt">{amount}</span>
        </div>
      ) : null}
    </div>
  );
}
