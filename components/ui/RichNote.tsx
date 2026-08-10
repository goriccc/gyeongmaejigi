'use client';

import type { CSSProperties, ReactNode } from 'react';
import { parseRichNote } from '@/lib/format/richNote';

const keyStyle: CSSProperties = {
  fontWeight: 700,
  color: '#14161f',
};

const warnStyle: CSSProperties = {
  fontWeight: 600,
  color: '#c46b1a',
};

/** warn 세그먼트 내부의 **볼드**만 처리 (중첩 !! 재파싱 방지) */
function renderInnerBold(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let n = 0;

  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const close = text.indexOf('**', i + 2);
      if (close !== -1) {
        nodes.push(
          <strong key={`${keyPrefix}-${n++}`} style={keyStyle}>
            {text.slice(i + 2, close)}
          </strong>,
        );
        i = close + 2;
        continue;
      }
    }

    const next = text.indexOf('**', i);
    if (next === -1) {
      nodes.push(text.slice(i));
      break;
    }
    nodes.push(text.slice(i, next));
    i = next;
  }

  return nodes.length ? nodes : [text];
}

/**
 * note 인라인 서식:
 * - **핵심** → 볼드
 * - !!경고!! → 주황 (닫는 !! 없으면 !!/【경고】부터 끝까지)
 */
export function RichNote({ text }: { text: string }) {
  if (!text) return null;

  return (
    <>
      {parseRichNote(text).map((seg, idx) => {
        if (seg.type === 'key') {
          return (
            <strong key={idx} style={keyStyle}>
              {seg.value}
            </strong>
          );
        }
        if (seg.type === 'warn') {
          return (
            <span key={idx} style={warnStyle}>
              {renderInnerBold(seg.value, `w${idx}`)}
            </span>
          );
        }
        return <span key={idx}>{seg.value}</span>;
      })}
    </>
  );
}
