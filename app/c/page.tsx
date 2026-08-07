'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { useCases } from '@/lib/hooks/useCases';
import { buildChecklist } from '@/lib/checklist';
import { ko } from '@/messages/ko';

export default function FieldPrepPage() {
  const { activeCase, cases, updateCase } = useCases();

  const checklist = useMemo(() => {
    if (!activeCase) return buildChecklist([]);
    if (activeCase.checklist.length > 0) return activeCase.checklist;
    return buildChecklist(activeCase.riskFlags);
  }, [activeCase]);

  const hasRiskFlags = Boolean(activeCase?.riskFlags?.length);

  const routeCases = useMemo(() => {
    return [...cases]
      .filter((c) => c.stage !== 'done')
      .sort((a, b) => a.auctionDate.localeCompare(b.auctionDate))
      .slice(0, 2);
  }, [cases]);

  function toggle(id: string) {
    if (!activeCase) return;
    const next = checklist.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item,
    );
    updateCase(activeCase.id, { checklist: next });
  }

  function formatDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  return (
    <>
      <div className="chapter-mark">제3장 · 임장 준비</div>
      <h1 className="page-title">
        가기 전에,
        <br />
        <em>뭘 봐야 할지</em> 압니다.
      </h1>
      <p className="page-sub">
        2장에서 나온 리스크 항목을 바탕으로 물건별 체크포인트를 만들고, 입찰
        마감일을 우선한 동선을 짭니다. 임장은 필수입니다 — 이 목록은 준비를 도울
        뿐입니다.
      </p>

      {!hasRiskFlags ? (
        <div className="banner">
          제2장 권리분석을 아직 하지 않으셨습니다.{' '}
          <Link href="/b">대조체크를 진행</Link>하면 이 물건에 맞는 확인 항목이
          추가됩니다.
        </div>
      ) : null}

      <Section
        title={
          activeCase
            ? `${activeCase.name} — 물건별 체크포인트`
            : '물건별 체크포인트'
        }
      >
        {checklist.map((item) => (
          <label className="checklist-item" key={item.id}>
            <input
              type="checkbox"
              className="chk-box"
              checked={item.checked}
              onChange={() => toggle(item.id)}
              disabled={!activeCase}
            />
            <div>
              {item.label}
              {item.source ? (
                <span className="chk-src">{item.source}</span>
              ) : null}
            </div>
          </label>
        ))}
      </Section>

      <Section title={`마감일 우선 임장 동선 (오늘 ${routeCases.length}건)`}>
        <div className="route-map" aria-hidden>
          {routeCases[0] ? (
            <div className="route-pin" style={{ top: 32, left: 44 }}>
              1
            </div>
          ) : null}
          {routeCases[1] ? (
            <div className="route-pin" style={{ top: 128, left: 196 }}>
              2
            </div>
          ) : null}
          {routeCases.length >= 2 ? (
            <div
              className="route-line"
              style={{
                top: 46,
                left: 60,
                width: 150,
                transform: 'rotate(21deg)',
                transformOrigin: '0 0',
              }}
            />
          ) : null}
        </div>
        {routeCases.length === 0 ? (
          <p className="s-note">
            진행 중인 사건이 없습니다. 사건철에서 사건을 추가해 주세요.
          </p>
        ) : (
          routeCases.map((c, i) => (
            <div className="result-row" key={c.id}>
              <span>
                {['①', '②'][i]} {c.name} ({c.caseNumber})
              </span>
              <span style={{ fontFamily: 'var(--mono)' }}>
                마감 {formatDate(c.auctionDate)}
              </span>
            </div>
          ))
        )}
        <p className="notice-inline">
          1단계 지도는 정적 mock입니다. 실제 좌표·동선은 2단계에서 연동됩니다.
        </p>
      </Section>

      {!activeCase ? (
        <div className="banner" style={{ marginTop: 16 }}>
          {ko.common.noActiveCase}
        </div>
      ) : null}

      <Disclaimer>
        관리사무소 운영시간처럼 현장에서만 확인되는 정보는 포함되지 않습니다.
        사전 전화 확인을 권합니다.
      </Disclaimer>
    </>
  );
}
