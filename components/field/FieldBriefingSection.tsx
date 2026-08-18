'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { caseDisplayName, caseTaskMetaLine, formatCaseNumberWithProperty } from '@/lib/caseUtils';
import { briefingNeedsRefetch } from '@/lib/field/briefingCache';
import { fetchFieldBriefingClient } from '@/lib/field/fetchFieldBriefingClient';
import {
  formatBuildYearLabel,
  formatScaleLabel,
} from '@/lib/field/briefingLabels';
import { formatExclusiveAreaM2 } from '@/lib/format';
import { useCases } from '@/lib/hooks/useCases';
import { ko } from '@/messages/ko';
import type { CaseFile } from '@/types/case';

const INITIAL_TRADE_COUNT = 5;

function formatTradeAmount(man: number): string {
  if (man >= 10_000) return `${(man / 10_000).toFixed(2).replace(/\.?0+$/, '')}억`;
  return `${man.toLocaleString('ko-KR')}만`;
}

function formatTradeDate(t: { yearMonth: string; day: number }): string {
  const [y, m] = t.yearMonth.split('-');
  return `${y.slice(2)}.${m}.${String(t.day).padStart(2, '0')}`;
}

type Props = {
  caseFile: CaseFile | null;
  stopOrder?: number | null;
};

export function FieldBriefingSection({ caseFile, stopOrder }: Props) {
  const { updateCase } = useCases();
  const [visibleCount, setVisibleCount] = useState(INITIAL_TRADE_COUNT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    setVisibleCount(INITIAL_TRADE_COUNT);
    setError('');
    setLoading(false);
  }, [caseFile?.id]);

  const briefing = caseFile?.fieldBriefing ?? null;

  async function refresh() {
    if (!caseFile?.address?.trim()) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError('');
    try {
      const next = await fetchFieldBriefingClient(caseFile, ac.signal);
      if (ac.signal.aborted) return;
      if (briefingNeedsRefetch(next)) {
        updateCase(caseFile.id, { fieldBriefing: undefined });
      } else {
        updateCase(caseFile.id, { fieldBriefing: next });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '브리핑 조회 실패');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  const trades = briefing?.trades ?? [];
  const shown = trades.slice(0, visibleCount);
  const scaleLabel = formatScaleLabel(briefing?.householdCount, briefing?.buildingCount);

  if (!caseFile) {
    return (
      <Section title={ko.fieldBriefing.title}>
        <p className="field-hint">
          {ko.common.noActiveCase}{' '}
          <Link href="/a">{ko.dashboard.mark}</Link>
        </p>
      </Section>
    );
  }

  const caseNumber = formatCaseNumberWithProperty(caseFile);
  const taskMeta = caseTaskMetaLine(caseFile);

  return (
    <Section title={ko.fieldBriefing.title} note={ko.fieldBriefing.lead}>
      <div className="field-briefing-head">
        <div>
          <div className="field-briefing-name">
            {stopOrder && stopOrder > 0 ? (
              <span
                className="route-pin field-route-stop-pin is-active"
                aria-label={`${stopOrder}번`}
              >
                {stopOrder}
              </span>
            ) : null}
            <div className="field-briefing-title-block">
              <div>{caseFile.address?.trim() || caseDisplayName(caseFile)}</div>
              {caseNumber ? (
                <div className="field-briefing-meta">{caseNumber}</div>
              ) : null}
              {taskMeta ? (
                <div className="field-briefing-meta">{taskMeta}</div>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn-text"
          disabled={loading || !caseFile.address}
          onClick={() => void refresh()}
        >
          {loading ? ko.common.loading : ko.fieldBriefing.refresh}
        </button>
      </div>

      {error ? <p className="notice-inline field-briefing-error">{error}</p> : null}

      <div className="field-briefing-stats">
        {briefing?.buildYear ? (
          <div className="field-brief-stat">
            <span className="field-brief-stat-k">연식</span>
            <span className="field-brief-stat-v">{formatBuildYearLabel(briefing.buildYear)}</span>
          </div>
        ) : null}
        {scaleLabel ? (
          <div className="field-brief-stat">
            <span className="field-brief-stat-k">규모</span>
            <span className="field-brief-stat-v">{scaleLabel}</span>
          </div>
        ) : null}
        {caseFile.exclusiveAreaM2 ? (
          <div className="field-brief-stat">
            <span className="field-brief-stat-k">전용</span>
            <span className="field-brief-stat-v">
              {formatExclusiveAreaM2(caseFile.exclusiveAreaM2)}
            </span>
          </div>
        ) : null}
        {caseFile.auctionRound ? (
          <div className="field-brief-stat">
            <span className="field-brief-stat-k">회차</span>
            <span className="field-brief-stat-v">{caseFile.auctionRound}회</span>
          </div>
        ) : null}
      </div>

      {shown.length > 0 ? (
        <div className="field-briefing-trades">
          <h4 className="field-briefing-sub">{ko.fieldBriefing.tradesTitle}</h4>
          <table className="field-trade-table">
            <thead>
              <tr>
                <th>일자</th>
                <th>동</th>
                <th>층</th>
                <th>면적</th>
                <th>금액</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t, i) => (
                <tr key={`${t.yearMonth}-${t.day}-${i}`}>
                  <td>{formatTradeDate(t)}</td>
                  <td>{t.dong ?? '—'}</td>
                  <td>{t.floor ?? '—'}</td>
                  <td>{t.areaM2 ? `${t.areaM2}㎡` : '—'}</td>
                  <td>{formatTradeAmount(t.amountMan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleCount < trades.length ? (
            <button
              type="button"
              className="btn-text field-brief-more"
              onClick={() => setVisibleCount(trades.length)}
            >
              {ko.fieldBriefing.loadMore(trades.length - visibleCount)}
            </button>
          ) : null}
        </div>
      ) : null}

      {briefing?.warnings?.length ? (
        <ul className="field-briefing-warn">
          {briefing.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {briefing?.trades?.length ? (
        <p className="field-hint">
          <Link href="/d">{ko.fieldBriefing.next}</Link>
        </p>
      ) : null}
    </Section>
  );
}
