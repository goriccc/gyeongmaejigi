'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ko } from '@/messages/ko';
import { useCases } from '@/lib/hooks/useCases';
import { getChapterProgress, stageBadgeLabel } from '@/lib/stage';
import { Badge } from '@/components/ui/Badge';
import { NewCaseForm } from '@/components/dashboard/NewCaseForm';
import { formatComma } from '@/lib/format';

function formatAuctionDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}`;
}

function appraisalLabel(n: number) {
  const eok = n / 100_000_000;
  if (eok >= 1) return `감정가 ${eok.toFixed(2).replace(/\.?0+$/, '')}억`;
  return `감정가 ${formatComma(n)}원`;
}

export default function DashboardPage() {
  const { cases, activeId, setActiveId, removeCase, hydrated, activeCase } =
    useCases();
  const [showForm, setShowForm] = useState(false);
  const stage = activeCase?.stage ?? 'A';

  if (!hydrated) {
    return <div className="cover" aria-busy="true" />;
  }

  return (
    <>
      <div className="cover">
        <div className="chapter-mark">{ko.dashboard.mark}</div>
        <h1>
          {ko.dashboard.titleBefore}
          <br />
          <em>{ko.dashboard.titleEm}</em>
          {ko.dashboard.titleAfter}
        </h1>
        <div className="cover-rule" />
        <p>{ko.dashboard.lead}</p>
        <Link href="/a" className="btn btn-primary">
          {ko.dashboard.cta}
        </Link>
      </div>

      {activeCase ? (
        <div className="lifecycle">
          <div className="lc-title">{ko.dashboard.lifecycle}</div>
          <div className="lc-row">
            {(
              [
                { ch: 'A' as const, href: '/a', name: '진입 매칭' },
                { ch: 'B' as const, href: '/b', name: '권리분석' },
                { ch: 'C' as const, href: '/c', name: '임장 준비' },
                { ch: 'D' as const, href: '/d', name: '입찰가 계산' },
                { ch: 'E' as const, href: '/e', name: '명도 코칭' },
              ] as const
            ).map((item) => {
              const progress = getChapterProgress(stage, item.ch);
              const done = progress === '완료';
              const active = progress === '진행중';
              return (
                <Link
                  key={item.ch}
                  href={item.href}
                  className={`lc-node${done ? ' done' : ''}${active ? ' active' : ''}`}
                >
                  <div className="lc-dot" />
                  <span className="lc-num">
                    제{['A', 'B', 'C', 'D', 'E'].indexOf(item.ch) + 1}장
                  </span>
                  <div className="lc-name">{item.name}</div>
                  <div className="lc-desc">{progress}</div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="docket-title">
        <span>{ko.dashboard.docket}</span>
        <button
          type="button"
          className="btn-text"
          onClick={() => setShowForm(true)}
        >
          {ko.dashboard.addCase}
        </button>
      </div>

      {cases.length === 0 ? (
        <div className="empty-state">
          <h3>{ko.dashboard.emptyTitle}</h3>
          <p>{ko.dashboard.emptyLead}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            {ko.dashboard.addCase}
          </button>
        </div>
      ) : (
        cases.map((c) => (
          <div className="docket-row" key={c.id}>
            <div>
              <div className="d-name">
                {c.name}{' '}
                {c.id === activeId ? (
                  <Badge tone="mid">{ko.dashboard.active}</Badge>
                ) : null}
              </div>
              <div className="d-meta">
                {c.caseNumber} · {appraisalLabel(c.appraisalValue)} · 매각기일{' '}
                {formatAuctionDate(c.auctionDate)}
              </div>
            </div>
            <div className="docket-actions">
              <Badge
                tone={
                  c.stage === 'B' || c.stage === 'E'
                    ? 'mid'
                    : c.stage === 'done'
                      ? 'ok'
                      : 'neutral'
                }
              >
                {stageBadgeLabel(c)}
              </Badge>
              {c.id !== activeId ? (
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setActiveId(c.id)}
                >
                  {ko.dashboard.selectCase}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-danger-text"
                onClick={() => {
                  if (window.confirm(`「${c.name}」 사건을 삭제할까요?`)) {
                    removeCase(c.id);
                  }
                }}
              >
                {ko.dashboard.deleteCase}
              </button>
            </div>
          </div>
        ))
      )}

      {showForm ? <NewCaseForm onClose={() => setShowForm(false)} /> : null}
    </>
  );
}
