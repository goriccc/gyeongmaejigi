import type { ReactNode } from 'react';

type Row = {
  label: ReactNode;
  value: ReactNode;
};

type Props = {
  mark?: string;
  figure: ReactNode;
  caption?: ReactNode;
  rows?: Row[];
  children?: ReactNode;
};

export function ResultPanel({ mark, figure, caption, rows, children }: Props) {
  return (
    <div className="result-panel">
      {mark ? (
        <div className="chapter-mark" style={{ color: 'var(--forest)' }}>
          {mark}
        </div>
      ) : null}
      <div className="result-figure">{figure}</div>
      {caption ? (
        <div style={{ fontSize: '12.5px', color: 'var(--slate)' }}>{caption}</div>
      ) : null}
      {rows?.map((row, i) => (
        <div className="result-row" key={i}>
          <span>{row.label}</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{row.value}</span>
        </div>
      ))}
      {children}
    </div>
  );
}
