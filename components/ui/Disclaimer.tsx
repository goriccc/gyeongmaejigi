import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function Disclaimer({ children }: Props) {
  return (
    <div className="disclaimer">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
