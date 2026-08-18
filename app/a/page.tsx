'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ko } from '@/messages/ko';
import { useCases } from '@/lib/hooks/useCases';
import { getCaseChapterProgress } from '@/lib/stage';
import { Badge } from '@/components/ui/Badge';
import { NewCaseForm } from '@/components/dashboard/NewCaseForm';
import { BiddingCaseViewModal } from '@/components/dashboard/BiddingCaseViewModal';
import { EvictionCaseForm } from '@/components/dashboard/EvictionCaseForm';
import {
  caseBadgeLabel,
  caseBadgeTone,
  caseDisplayName,
  caseTaskMetaLine,
  daysUntilAuction,
  formatCaseNumberWithProperty,
  getNextAction,
  groupCases,
  normalizeCaseTrack,
} from '@/lib/caseUtils';
import type { CaseFile } from '@/types/case';

function TaskCard({
  c,
  activeId,
  onOpen,
  onView,
  onRemove,
}: {
  c: CaseFile;
  activeId: string | null;
  onOpen: (id: string, href: string) => void;
  onView: (c: CaseFile) => void;
  onRemove: (id: string) => void;
}) {
  const next = getNextAction(c);
  const dday = daysUntilAuction(c.auctionDate);
  const canView = normalizeCaseTrack(c) === 'bidding';

  return (
    <div className="task-card">
      {formatCaseNumberWithProperty(c) ? (
        <div className="task-card-case-no">{formatCaseNumberWithProperty(c)}</div>
      ) : null}
      <div className="task-card-row">
        <div className="task-card-main">
          <div className="task-card-head">
            {canView ? (
              <button
                type="button"
                className="task-card-name task-card-name-btn"
                onClick={() => onView(c)}
              >
                {caseDisplayName(c)}
              </button>
            ) : (
              <span className="task-card-name">{caseDisplayName(c)}</span>
            )}
            {c.id === activeId ? (
              <Badge tone="mid">{ko.dashboard.active}</Badge>
            ) : null}
            <Badge tone={caseBadgeTone(c)}>{caseBadgeLabel(c)}</Badge>
          </div>
          <div className="task-card-meta">
            {caseTaskMetaLine(c)}
            {dday != null && dday >= 0 ? (
              <span className="task-dday">
                {dday === 0 ? 'D-day' : `D-${dday}`}
              </span>
            ) : null}
          </div>
        </div>
        <div className="task-card-buttons">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onOpen(c.id, next.href)}
          >
            {next.label}
          </button>
          <button
            type="button"
            className="btn-danger-text"
            onClick={() => {
              if (window.confirm(`「${c.name}」 사건을 삭제할까요?`)) {
                onRemove(c.id);
              }
            }}
          >
            {ko.dashboard.deleteCase}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { cases, activeId, setActiveId, removeCase, hydrated, activeCase } =
    useCases();
  const router = useRouter();
  const [showBiddingForm, setShowBiddingForm] = useState(false);
  const [showEvictionForm, setShowEvictionForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewCase, setViewCase] = useState<CaseFile | null>(null);

  const groups = useMemo(() => groupCases(cases), [cases]);

  const viewCaseLive = useMemo(
    () =>
      viewCase ? cases.find((c) => c.id === viewCase.id) ?? viewCase : null,
    [cases, viewCase],
  );

  const primaryTask = useMemo(() => {
    const urgent =
      groups.thisWeek[0] ??
      groups.postWin[0] ??
      groups.eviction[0] ??
      groups.reviewing[0] ??
      activeCase;
    if (!urgent) return null;
    return { case: urgent, action: getNextAction(urgent) };
  }, [groups, activeCase]);

  function openCase(id: string, href: string) {
    setActiveId(id);
    router.push(href);
  }

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
        <div className="cover-actions">
          {primaryTask ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openCase(primaryTask.case.id, primaryTask.action.href)}
            >
              {ko.dashboard.nextTask(primaryTask.action.label)}
            </button>
          ) : (
            <Link href="/" className="btn btn-primary">
              {ko.dashboard.cta}
            </Link>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowEvictionForm(true)}
          >
            {ko.dashboard.ctaEviction}
          </button>
        </div>
      </div>

      <section className="task-section">
        <div className="task-section-top">
          <button
            type="button"
            className="btn-text task-section-action"
            onClick={() => setShowBiddingForm(true)}
          >
            {ko.dashboard.addCase}
          </button>
        </div>
        <h2 className="task-section-title task-section-title-main">
          {ko.dashboard.groupThisWeek}
        </h2>
        {groups.thisWeek.map((c) => (
          <TaskCard
            key={c.id}
            c={c}
            activeId={activeId}
            onOpen={openCase}
            onView={setViewCase}
            onRemove={removeCase}
          />
        ))}
        {groups.reviewing.length > 0 ? (
          <>
            <p className="task-group-label">{ko.dashboard.groupReviewing}</p>
            {groups.reviewing.map((c) => (
              <TaskCard
                key={c.id}
                c={c}
                activeId={activeId}
                onOpen={openCase}
                onView={setViewCase}
                onRemove={removeCase}
              />
            ))}
          </>
        ) : null}
        {groups.postWin.length > 0 ? (
          <>
            <p className="task-group-label">{ko.dashboard.groupPostWin}</p>
            {groups.postWin.map((c) => (
              <TaskCard
                key={c.id}
                c={c}
                activeId={activeId}
                onOpen={openCase}
                onView={setViewCase}
                onRemove={removeCase}
              />
            ))}
          </>
        ) : null}
        {groups.eviction.length > 0 ? (
          <>
            <p className="task-group-label">{ko.dashboard.groupEviction}</p>
            {groups.eviction.map((c) => (
              <TaskCard
                key={c.id}
                c={c}
                activeId={activeId}
                onOpen={openCase}
                onView={setViewCase}
                onRemove={removeCase}
              />
            ))}
          </>
        ) : null}
        {groups.archived.length > 0 ? (
          <>
            <button
              type="button"
              className="btn-text task-group-label task-archived-toggle"
              onClick={() => setShowArchived((v) => !v)}
            >
              {ko.dashboard.archivedToggle(groups.archived.length)}
              {showArchived ? ' ▲' : ' ▼'}
            </button>
            {showArchived
              ? groups.archived.map((c) => (
                  <TaskCard
                    key={c.id}
                    c={c}
                    activeId={activeId}
                    onOpen={openCase}
                    onView={setViewCase}
                    onRemove={removeCase}
                  />
                ))
              : null}
          </>
        ) : null}
      </section>

      {activeCase ? (
        <div className="lifecycle">
          <div className="lc-title">{ko.dashboard.lifecycle}</div>
          <div className="lc-row">
            {(
              [
                { ch: 'A' as const, href: '/a', name: '입찰사건' },
                { ch: 'B' as const, href: '/b', name: '권리분석' },
                { ch: 'C' as const, href: '/c', name: '임장 준비' },
                { ch: 'D' as const, href: '/d', name: '입찰가 계산' },
                { ch: 'F' as const, href: '/f', name: '대출상품 비교' },
                { ch: 'E' as const, href: '/e', name: '명도 코칭' },
              ] as const
            ).map((item) => {
              const progress = getCaseChapterProgress(activeCase, item.ch);
              const done = progress === '완료';
              const active = progress === '진행중';
              const skipped = progress === '건너뜀';
              const chapterNums: Record<(typeof item)['ch'], number> = {
                A: 1,
                B: 2,
                C: 3,
                D: 4,
                F: 5,
                E: 6,
              };
              return (
                <Link
                  key={item.ch}
                  href={item.href}
                  className={`lc-node${done ? ' done' : ''}${active ? ' active' : ''}${skipped ? ' skipped' : ''}`}
                >
                  <div className="lc-dot" />
                  <span className="lc-num">제{chapterNums[item.ch]}장</span>
                  <div className="lc-name">{item.name}</div>
                  <div className="lc-desc">{progress}</div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {showBiddingForm ? (
        <NewCaseForm onClose={() => setShowBiddingForm(false)} />
      ) : null}
      {viewCaseLive ? (
        <BiddingCaseViewModal
          caseFile={viewCaseLive}
          onClose={() => setViewCase(null)}
        />
      ) : null}
      {showEvictionForm ? (
        <EvictionCaseForm onClose={() => setShowEvictionForm(false)} />
      ) : null}
    </>
  );
}
