import type { CSSProperties, ReactNode } from 'react';

type Props = {
  title?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Section({ title, note, children, className, style }: Props) {
  return (
    <div className={`section${className ? ` ${className}` : ''}`} style={style}>
      {title ? <h3>{title}</h3> : null}
      {note ? <p className="s-note">{note}</p> : null}
      {children}
    </div>
  );
}
