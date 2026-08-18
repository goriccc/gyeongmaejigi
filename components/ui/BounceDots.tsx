export function BounceDots({
  text = '조회 중',
}: {
  text?: string;
}) {
  return (
    <span className="bounce-status" role="status" aria-label={text}>
      {text ? <span className="bounce-status-text">{text}</span> : null}
      <span className="bounce-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}
