'use client';

import { useRef, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { RiskRow } from '@/components/ui/RiskRow';
import { Disclaimer } from '@/components/ui/Disclaimer';
import type { BadgeTone } from '@/components/ui/Badge';
import { useCases } from '@/lib/hooks/useCases';
import { MOCK_RISK_FLAGS, buildChecklist } from '@/lib/checklist';
import { afterRiskFlagsSaved } from '@/lib/stage';
import { ko } from '@/messages/ko';
import type { RiskFlag } from '@/types/case';

function statusBadge(status: RiskFlag['status']): {
  label: string;
  tone: BadgeTone;
} {
  if (status === 'warning') return { label: '확인 필요', tone: 'warn' };
  if (status === 'mismatch') return { label: '불일치', tone: 'warn' };
  if (status === 'ok') {
    return { label: '양호', tone: 'ok' };
  }
  return { label: '일치', tone: 'ok' };
}

export default function RightsAnalysisPage() {
  const { activeCase, updateCase } = useCases();
  const inputRef = useRef<HTMLInputElement>(null);
  const [judgment, setJudgment] = useState(
    '대항력 있는 임차인 없음, 선순위 근저당 1건이 말소기준권리로 판단됨',
  );
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RiskFlag[] | null>(
    activeCase?.riskFlags?.length ? activeCase.riskFlags : null,
  );
  const [dragOver, setDragOver] = useState(false);

  function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setFiles(Array.from(list).map((f) => f.name));
  }

  async function analyze() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    const flags = MOCK_RISK_FLAGS.map((f) => ({ ...f }));
    // 말소기준권리는 목업에서 "일치" 배지
    const display = flags.map((f) =>
      f.label === '말소기준권리' ? { ...f, status: 'ok' as const } : f,
    );
    setResults(display);
    setLoading(false);

    if (activeCase) {
      const checklist = buildChecklist(display, activeCase.checklist);
      updateCase(activeCase.id, {
        riskFlags: display,
        checklist,
        stage: afterRiskFlagsSaved(activeCase.stage),
      });
    }
  }

  const shown = results;

  return (
    <>
      <div className="chapter-mark">제2장 · 권리분석</div>
      <h1 className="page-title">
        이미 분석하셨어도,
        <br />
        <em>한 번 더</em> 보세요.
      </h1>
      <p className="page-sub">
        등기부등본·매각물건명세서·현황조사서를 넣으면 위험 요소를 자동
        탐지합니다. 본인이 이미 판단한 내용을 함께 넣으면 어디가 다른지 대조해
        드립니다.
      </p>

      {!activeCase ? (
        <div className="banner">{ko.common.noActiveCase}</div>
      ) : null}

      <Section title="문서 업로드">
        <div
          className={`dropzone${dragOver ? ' dragover' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
        >
          등기부등본 · 매각물건명세서 · 현황조사서를 끌어다 놓거나 클릭해서 첨부
          {files.length > 0 ? (
            <div className="dropzone-files">{files.join(' · ')} (미리보기만, 저장되지 않음)</div>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          style={{ display: 'none' }}
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="field" style={{ marginTop: 22 }}>
          <label htmlFor="judgment">
            본인이 판단한 권리분석 결과 (선택 — 넣으면 대조해 드립니다)
          </label>
          <textarea
            id="judgment"
            value={judgment}
            onChange={(e) => setJudgment(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={analyze}
          disabled={loading}
        >
          {loading ? ko.common.loading : '대조 분석 시작'}
        </button>
      </Section>

      {shown ? (
        <Section title="대조 분석 결과">
          {shown.map((flag) => {
            const badge =
              flag.label === '말소기준권리'
                ? { label: '일치', tone: 'ok' as const }
                : statusBadge(flag.status);
            return (
              <RiskRow
                key={flag.label}
                name={flag.label}
                note={flag.note}
                badge={badge.label}
                badgeTone={badge.tone}
                diffTag={
                  flag.status === 'warning' ? '본인 판단과 다름' : undefined
                }
              />
            );
          })}
        </Section>
      ) : null}

      <Disclaimer>
        문서 내 위험 패턴을 탐지해 정보를 제공할 뿐, 법적 판단이 아닙니다. 확인이
        필요한 항목은 반드시 원문을 직접 확인하세요.
      </Disclaimer>
    </>
  );
}
