export function SealMark({ className = 'seal-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="17.5" stroke="#14161F" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="13.5" stroke="#B08A45" strokeWidth="1" />
      <path
        d="M13 20.5l4.2 4.2L27.5 14.5"
        stroke="#14161F"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
