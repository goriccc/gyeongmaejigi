import type {
  FieldRouteLegGuide,
  FieldRouteMode,
  RouteStop,
} from '@/lib/field/types';
import { getRouteLegColor } from '@/lib/field/routeLegColors';

type Props = {
  mode: FieldRouteMode;
  legs: FieldRouteLegGuide[];
  stops: RouteStop[];
  selectedCaseId: string | null;
  loading?: boolean;
};

function legBadges(index: number): { from: string; to: string } {
  return {
    from: index === 0 ? 'S' : String(index),
    to: String(index + 1),
  };
}

function isStopOrderActive(
  order: number,
  stops: RouteStop[],
  selectedCaseId: string | null,
): boolean {
  const stop = stops.find((s) => s.order === order);
  return Boolean(stop && stop.caseId === selectedCaseId);
}

function GuidePin({
  label,
  start = false,
  active = false,
}: {
  label: string;
  start?: boolean;
  active?: boolean;
}) {
  return (
    <span
      className={`route-pin field-route-guide-pin${start ? ' is-start' : ''}${active ? ' is-active' : ''}`}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

export function FieldRouteGuide({
  mode,
  legs,
  stops,
  selectedCaseId,
  loading = false,
}: Props) {
  if (loading || legs.length === 0) return null;

  const heading = mode === 'car' ? '도로 안내' : '대중교통 안내';

  function pinActive(label: string): boolean {
    if (label === 'S') return false;
    const order = Number(label);
    if (!Number.isFinite(order)) return false;
    return isStopOrderActive(order, stops, selectedCaseId);
  }

  return (
    <div className="field-route-guide" aria-label={heading}>
      <p className="field-route-guide-heading">{heading}</p>
      {legs.map((leg, index) => {
        const badges = legBadges(index);
        return (
          <section className="field-route-guide-leg" key={`${leg.from}-${leg.to}-${index}`}>
            <div
              className="field-route-guide-leg-color"
              style={{ background: getRouteLegColor(index) }}
              aria-hidden="true"
            />
            <div className="field-route-guide-leg-body">
            <div className="field-route-guide-leg-header">
              <div className="field-route-guide-endpoint">
                <GuidePin
                  label={badges.from}
                  start={badges.from === 'S'}
                  active={pinActive(badges.from)}
                />
                <span className="field-route-guide-endpoint-label">{leg.from}</span>
              </div>
              <span className="field-route-guide-arrow" aria-hidden="true">
                →
              </span>
              <div className="field-route-guide-endpoint">
                <GuidePin label={badges.to} active={pinActive(badges.to)} />
                <span className="field-route-guide-endpoint-label">{leg.to}</span>
              </div>
            </div>
            {leg.items.length > 0 ? (
              <ol className="field-route-guide-list">
                {leg.items.map((item, itemIndex) => (
                  <li className="field-route-guide-item" key={`${item.label}-${itemIndex}`}>
                    <span className="field-route-guide-label">{item.label}</span>
                    {item.detail ? (
                      <span className="field-route-guide-detail">{item.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="s-note field-route-guide-empty">안내 정보 없음</p>
            )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
