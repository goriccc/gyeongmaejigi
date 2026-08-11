'use client';

import type { CaseFile } from '@/types/case';

type Props = {
  cases: CaseFile[];
};

function mapSearchUrl(address: string) {
  return `https://map.kakao.com/?q=${encodeURIComponent(address)}`;
}

export function RouteMap({ cases }: Props) {
  const withGeo = cases.filter(
    (c) =>
      typeof c.latitude === 'number' &&
      typeof c.longitude === 'number' &&
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude),
  );

  if (withGeo.length === 0) {
    return (
      <div className="route-map route-map-empty">
        <p className="s-note">
          좌표 정보가 없어 지도 핀을 표시하지 못했습니다. 아래 주소에서 지도를
          열어 확인해 주세요.
        </p>
      </div>
    );
  }

  const lats = withGeo.map((c) => c.latitude as number);
  const lngs = withGeo.map((c) => c.longitude as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.15, 0.01);
  const lngPad = Math.max((maxLng - minLng) * 0.15, 0.01);
  const bounds = {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };

  function toPos(lat: number, lng: number) {
    const top =
      ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 100;
    const left =
      ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    return {
      top: `${Math.min(92, Math.max(8, top))}%`,
      left: `${Math.min(92, Math.max(8, left))}%`,
    };
  }

  const ordered = [...withGeo];
  if (ordered.length >= 2) {
    const [a, b] = ordered;
    const pa = toPos(a.latitude as number, a.longitude as number);
    const pb = toPos(b.latitude as number, b.longitude as number);
    const dx = parseFloat(pb.left) - parseFloat(pa.left);
    const dy = parseFloat(pb.top) - parseFloat(pa.top);
    const width = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    return (
      <div className="route-map" aria-label="임장 동선 지도">
        {ordered.map((c, i) => {
          const pos = toPos(c.latitude as number, c.longitude as number);
          return (
            <div
              key={c.id}
              className="route-pin"
              style={{ top: pos.top, left: pos.left }}
              title={c.address || c.name}
            >
              {i + 1}
            </div>
          );
        })}
        <div
          className="route-line"
          style={{
            top: pa.top,
            left: pa.left,
            width: `${width}%`,
            transform: `rotate(${angle}deg)`,
            transformOrigin: '0 0',
          }}
        />
      </div>
    );
  }

  const c = ordered[0];
  const pos = toPos(c.latitude as number, c.longitude as number);
  return (
    <div className="route-map" aria-label="임장 동선 지도">
      <div
        className="route-pin"
        style={{ top: pos.top, left: pos.left }}
        title={c.address || c.name}
      >
        1
      </div>
    </div>
  );
}

export function RouteAddressLinks({ cases }: Props) {
  return (
    <>
      {cases.map((c, i) => (
        <div className="result-row route-row" key={c.id}>
          <span className="route-row-main">
            <span className="route-order">{['①', '②', '③'][i] ?? `${i + 1}.`}</span>
            <span>
              <strong>{c.name}</strong>
              {c.address ? (
                <span className="route-address">{c.address}</span>
              ) : null}
              <span className="route-case-meta">{c.caseNumber}</span>
            </span>
          </span>
          <span className="route-row-actions">
            {c.address ? (
              <a
                href={mapSearchUrl(c.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-text"
              >
                지도
              </a>
            ) : null}
            <span style={{ fontFamily: 'var(--mono)' }}>
              마감 {formatDate(c.auctionDate)}
            </span>
          </span>
        </div>
      ))}
    </>
  );
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
