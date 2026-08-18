'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ko } from '@/messages/ko';
import { useCases } from '@/lib/hooks/useCases';
import {
  caseBadgeLabel,
  caseBadgeTone,
  caseDisplayName,
  caseMetaLine,
  contextSummary,
  groupCases,
  isArchivedCase,
} from '@/lib/caseUtils';
import { Badge } from '@/components/ui/Badge';

export function CaseContextBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { cases, activeCase, activeId, setActiveId, hydrated } = useCases();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupCases(cases), [cases]);
  const activeCases = useMemo(
    () => cases.filter((c) => !isArchivedCase(c)),
    [cases],
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname, activeId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [open]);

  if (!hydrated || pathname === '/' || pathname === '/a') return null;

  function selectCase(id: string) {
    setActiveId(id);
    setOpen(false);
  }

  function renderGroup(title: string, items: typeof cases) {
    if (!items.length) return null;
    return (
      <div className="ctx-group">
        <div className="ctx-group-title">{title}</div>
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ctx-option${c.id === activeId ? ' active' : ''}`}
            onClick={() => selectCase(c.id)}
          >
            <span className="ctx-option-name">{caseDisplayName(c)}</span>
            <span className="ctx-option-meta">
              {caseMetaLine(c) || caseBadgeLabel(c)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="case-context-bar" ref={rootRef}>
      <button
        type="button"
        className="ctx-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {activeCase ? (
          <>
            <span className="ctx-name">{caseDisplayName(activeCase)}</span>
            <Badge tone={caseBadgeTone(activeCase)}>
              {caseBadgeLabel(activeCase)}
            </Badge>
            <span className="ctx-meta">
              {caseMetaLine(activeCase) || contextSummary(activeCase)}
            </span>
          </>
        ) : (
          <span className="ctx-name">{ko.contextBar.noCase}</span>
        )}
        <span className="ctx-chevron" aria-hidden>
          ▼
        </span>
      </button>

      {open ? (
        <div className="ctx-dropdown" role="listbox" aria-label={ko.contextBar.switch}>
          {activeCases.length === 0 ? (
            <div className="ctx-empty">{ko.contextBar.noCase}</div>
          ) : (
            <>
              {renderGroup(ko.dashboard.groupThisWeek, groups.thisWeek)}
              {renderGroup(ko.dashboard.groupReviewing, groups.reviewing)}
              {renderGroup(ko.dashboard.groupPostWin, groups.postWin)}
              {renderGroup(ko.dashboard.groupEviction, groups.eviction)}
            </>
          )}
          <button
            type="button"
            className="ctx-footer-link"
            onClick={() => {
              setOpen(false);
              router.push('/a');
            }}
          >
            {ko.nav.a}에서 전체 보기
          </button>
        </div>
      ) : null}
    </div>
  );
}
