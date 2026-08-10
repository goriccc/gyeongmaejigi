'use client';

import { useMemo, type ReactNode } from 'react';
import type { HouseCount, RegZone } from '@/lib/calc/acquisitionTax';
import {
  lowPriceThreshold,
  PARTIAL_REGIONS,
  REGULATED_AS_OF,
  REGION_TILES,
  regionStatus,
  SUDOGWON,
  type RegionStatus,
} from '@/data/regulatedRegions';

const HOUSE_LABELS: Record<HouseCount, string> = {
  0: '무주택',
  1: '1주택',
  2: '2주택',
  3: '3주택 이상',
};

const REG_ZONE_LABEL: Record<RegZone, string> = {
  none: '비규제지역',
  adjusted: '조정대상지역',
  overheated: '투기과열지구',
};

const MOUTH_PATHS = {
  ok: 'M17 30 Q26 38 35 30',
  warn: 'M18 33 Q26 35 34 33',
  blocked: 'M17 34 Q26 27 35 34',
} as const;

type Props = {
  houseCount: HouseCount;
  sudogwon: boolean;
  regZone: RegZone;
  ltvApplied: number;
  taxRate: number;
  lowPriceException?: boolean;
  dispositionPlanned?: boolean;
  firstTimeBuyer?: boolean;
  realDemand?: boolean;
  /** 지도 오른쪽 요약 패널 (계산 중복 없이 표시만) */
  summary?: ReactNode;
};

export function RegionEligibilityMap({
  houseCount,
  sudogwon,
  regZone,
  ltvApplied,
  taxRate,
  lowPriceException = false,
  dispositionPlanned = false,
  firstTimeBuyer = false,
  realDemand = false,
  summary,
}: Props) {
  // 특례 boolean → activeTags를 최상단에서 한 번만 계산 (선언 순서 버그 방지)
  const ftb = houseCount === 0 && firstTimeBuyer;
  const rd = houseCount === 0 && realDemand;
  const lowPrice = lowPriceException;
  const disposition = dispositionPlanned;

  const activeTags = useMemo(() => {
    const tags: string[] = [];
    if (ftb) tags.push('생애최초');
    if (rd) tags.push('서민·실수요자');
    if (lowPrice) tags.push('저가주택특례');
    if (disposition) tags.push('처분조건부');
    return tags;
  }, [ftb, rd, lowPrice, disposition]);

  const byStatus: Record<RegionStatus, string[]> = {
    ok: [],
    warn: [],
    blocked: [],
  };

  const tiles = REGION_TILES.map((tile) => {
    const region = tile.name;
    const status = regionStatus(
      SUDOGWON.includes(region),
      houseCount,
      lowPrice,
      disposition,
    );
    byStatus[status].push(region);
    return { ...tile, status };
  });

  const taxSurcharged = taxRate >= 0.08;
  let verdict: 'ok' | 'warn' | 'blocked';
  let statusText: string;
  if (ltvApplied <= 0) {
    verdict = 'blocked';
    statusText = '대출 사실상 불가';
  } else if (taxSurcharged && activeTags.length === 0) {
    verdict = 'warn';
    statusText = '대출 가능 · 세금 불리';
  } else {
    verdict = 'ok';
    statusText = '대출 가능';
  }

  const detailText =
    `${HOUSE_LABELS[houseCount]} · ${sudogwon ? '수도권' : '지방'} · ${REG_ZONE_LABEL[regZone]}` +
    ` 기준 — 적용 LTV ${(ltvApplied * 100).toFixed(0)}%, 취득세 ${(taxRate * 100).toFixed(1)}%` +
    (activeTags.length ? ` · ${activeTags.join('·')} 적용` : '');

  return (
    <div className="section">
      <h3>지역별 투자 가능 여부 (전국)</h3>
      <p className="s-note">
        &quot;투자하기 좋은 곳&quot;이 아니라 &quot;지금 설정으로 대출·세금이
        어떻게 되는지&quot;만 보여드립니다. 실제 투자 지역 선택은 전적으로 본인
        몫입니다.
      </p>

      <div className={`verdict-banner vb-${verdict}`}>
        <svg
          className="vb-avatar"
          viewBox="0 0 52 52"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <circle cx="26" cy="26" r="24" fill="var(--paper)" />
          <circle cx="19" cy="23" r="2.4" fill="var(--ink)" />
          <circle cx="33" cy="23" r="2.4" fill="var(--ink)" />
          <path
            d={MOUTH_PATHS[verdict]}
            stroke="var(--ink)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <div className="vb-body">
          <span className="vb-status">{statusText}</span>
          <span className="vb-detail">{detailText}</span>
        </div>
      </div>

      <div className="rule-panel">
        <div className="rp-title">색상·계산 기준</div>
        <div className="region-legend">
          <span>
            <i style={{ background: 'var(--forest)' }} /> 완전 가능 (일반세율)
          </span>
          <span>
            <i
              style={{
                background: 'rgba(176,138,69,0.32)',
                border: '1px solid rgba(176,138,69,0.6)',
              }}
            />{' '}
            대출은 가능하나 불리
          </span>
          <span>
            <i
              style={{
                background: 'rgba(140,47,38,0.28)',
                border: '1px solid rgba(140,47,38,0.55)',
              }}
            />{' '}
            대출 사실상 불가
          </span>
        </div>
        <p className="s-note" style={{ marginBottom: 6 }}>
          2025.6.27·10.15 부동산대책 기준, 수도권(서울·경기·인천)은
          조정대상지역 지정 여부와 무관하게 전역이 다주택 대출금지 대상입니다.
          지방은 이 대책 대상이 아니지만, 3주택 이상은 취득세 8% 중과가 전국
          공통으로 적용됩니다.
        </p>
        <p className="s-note" style={{ marginBottom: 6 }}>
          경매는 경쟁입찰입니다. 취득세가 8%p 높으면 그만큼 입찰 여력이 줄어
          일반세율 경쟁자를 이기기 어려워질 수 있습니다 — &quot;대출이
          된다&quot;와 &quot;경쟁력이 있다&quot;는 다릅니다.
        </p>
        <p className="s-note" style={{ marginBottom: 0 }}>
          저가주택 특례·처분조건부·생애최초·서민실수요자 중 하나라도 해당하면
          위 배지 색이 실제보다 유리하게 바뀔 수 있습니다. &quot;해당함&quot;으로
          선택하면 타일 하단에 기준 공시가격(수도권 1억원 / 지방 2억원)도 함께
          표시됩니다.
        </p>
      </div>

      <div className="region-map-flex">
        <div className="region-map-wrap">
          <div className="region-map" id="regionMap">
            {tiles.map((tile) => (
              <div
                key={tile.name}
                className={`region-tile ${tile.status}`}
                data-region={tile.name}
                style={{
                  gridColumn: tile.column,
                  gridRow: tile.row,
                }}
              >
                <span className="rt-name">{tile.name}</span>
                {lowPrice ? (
                  <span className="rt-threshold">
                    {lowPriceThreshold(tile.name)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {summary}
      </div>

      <div className="region-list">
        {disposition ? (
          <>
            <span style={{ color: 'var(--brass-deep)' }}>
              처분조건부(일시적 2주택) 적용 중 — 무주택자와 동일하게 취급되어
              전국 대출·세금 모두 정상 적용됩니다.
            </span>
            <br />
          </>
        ) : (
          <>
            {houseCount >= 1 ? (
              <>
                <span style={{ color: 'var(--slate)' }}>
                  수도권(서울·경기·인천)은 조정대상지역 지정 여부와 무관하게
                  전역이 2025.6.27 대책 대출금지 대상입니다.
                </span>
                <br />
              </>
            ) : null}
            {lowPrice ? (
              <>
                <span style={{ color: 'var(--brass-deep)' }}>
                  저가주택 특례 적용 중 — 지방의 취득세 중과는 해소되고,
                  수도권의 대출금지도 완전차단 대신 LTV 40%(1금융)·50%(2금융)로
                  완화됩니다.
                </span>
                <br />
              </>
            ) : null}
          </>
        )}
        {byStatus.blocked.length > 0 ? (
          <>
            <b>대출 사실상 불가 (수도권, 6.27대책):</b>{' '}
            {byStatus.blocked.join(', ')}
            <br />
          </>
        ) : null}
        {byStatus.warn.length > 0 ? (
          <>
            <b>대출은 가능하나 불리 (세금 중과 또는 LTV 축소):</b>{' '}
            {byStatus.warn.join(', ')}
            <br />
          </>
        ) : null}
        <b>완전 가능:</b>{' '}
        {byStatus.ok.length > 0 ? byStatus.ok.join(', ') : '해당 없음'}
        <br />
        <span style={{ color: 'var(--slate)' }}>
          지방의 LTV는 정부 상한이 없어 은행 자율입니다 — 위 계산기의 LTV
          수치는 참고치이며 확정값이 아닙니다.
        </span>
        {PARTIAL_REGIONS.경기 ? (
          <>
            <br />
            <span style={{ color: 'var(--slate)' }}>
              취득세 규제구분 참고 — 경기 조정대상지역 세부:{' '}
              {PARTIAL_REGIONS.경기.join(' · ')}
            </span>
          </>
        ) : null}
      </div>

      <p className="s-note" style={{ marginTop: 14 }}>
        기준일 {REGULATED_AS_OF} · 국토교통부 고시 기준 (2026.7.1 화성시
        동탄구·용인시 기흥구·구리시 추가 지정 반영) ·{' '}
        <a
          href="https://www.molit.go.kr"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--brass-deep)', textDecoration: 'underline' }}
        >
          국토부에서 최신 고시 확인
        </a>{' '}
        — 지도는 시·도 단위 스키매틱 참고용이며, 실제 소재지 단위 확인은 위
        링크에서 반드시 재확인하세요.
      </p>
    </div>
  );
}
