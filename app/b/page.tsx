'use client';

import { useEffect, useRef, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { ModelResultBlock } from '@/components/rights/ModelResultBlock';
import { useCases } from '@/lib/hooks/useCases';
import { buildChecklist } from '@/lib/checklist';
import { mergeRiskFlagsForChecklist } from '@/lib/llm/rightsPrompt';
import { readNdjsonStream } from '@/lib/http/readNdjsonStream';
import { afterRiskFlagsSaved } from '@/lib/stage';
import { ko } from '@/messages/ko';
import type {
  ModelAnalysisResult,
  RightsAnalysisCompare,
} from '@/types/case';

type RightsStreamEvent =
  | { type: 'result'; result: ModelAnalysisResult }
  | { type: 'done'; analyzedAt: string }
  | { type: 'error'; error: string };

export default function RightsAnalysisPage() {
  const { activeCase, updateCase } = useCases();
  const inputRef = useRef<HTMLInputElement>(null);
  const [judgment, setJudgment] = useState(
    '대항력 있는 임차인 없음, 선순위 근저당 1건이 말소기준권리로 판단됨',
  );
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compare, setCompare] = useState<RightsAnalysisCompare | null>(
    activeCase?.rightsAnalysis ?? null,
  );
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (activeCase?.rightsAnalysis) {
      setCompare(activeCase.rightsAnalysis);
    }
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setFiles(Array.from(list));
  }

  function persistCompare(next: RightsAnalysisCompare) {
    const merged = mergeRiskFlagsForChecklist(next.claude?.riskFlags ?? []);
    if (!activeCase) return;
    const checklist = buildChecklist(merged, activeCase.checklist);
    updateCase(activeCase.id, {
      rightsAnalysis: next,
      riskFlags: merged,
      checklist,
      stage: afterRiskFlagsSaved(activeCase.stage),
    });
  }

  async function analyze() {
    setLoading(true);
    setError('');
    setCompare({ analyzedAt: new Date().toISOString() });
    try {
      const form = new FormData();
      form.append('judgment', judgment);
      for (const file of files) {
        form.append('files', file);
      }

      const res = await fetch('/api/rights-analysis', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(100_000),
      });
      if (!res.ok && !res.body) {
        throw new Error('분석 요청에 실패했습니다.');
      }

      let latest: RightsAnalysisCompare = {
        analyzedAt: new Date().toISOString(),
      };

      await readNdjsonStream<RightsStreamEvent>(res, (event) => {
        if (event.type === 'error') {
          throw new Error(event.error || '분석 요청에 실패했습니다.');
        }
        if (event.type === 'result') {
          latest = {
            ...latest,
            claude: { ...event.result, label: 'AI 권리분석' },
          };
          setCompare(latest);
          persistCompare(latest);
        }
        if (event.type === 'done') {
          latest = { ...latest, analyzedAt: event.analyzedAt };
          setCompare(latest);
          persistCompare(latest);
        }
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }

  const pdfCount = files.filter(
    (f) =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
  ).length;

  return (
    <>
      <div className="chapter-mark">제2장 · 권리분석</div>
      <h1 className="page-title">
        이미 분석하셨어도,
        <br />
        <em>한 번 더</em> 보세요.
      </h1>
      <p className="page-sub">
        등기부등본·토지등기·매각물건명세서·현황조사서를 올리면 AI가 8개 필수
        항목을 점검합니다. PDF 원본은 서버에 저장되지 않습니다.
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
          등기부등본 · 토지등기 · 매각물건명세서 · 현황조사서 PDF를 끌어다
          놓거나 클릭해서 첨부
          {files.length > 0 ? (
            <div className="dropzone-files">
              {files.map((f) => f.name).join(' · ')}
              {pdfCount > 0
                ? ` (PDF ${pdfCount}건 · 원본 미저장)`
                : ' (원본은 저장되지 않음)'}
            </div>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md"
          style={{ display: 'none' }}
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="field" style={{ marginTop: 22 }}>
          <label htmlFor="judgment">
            본인이 판단한 권리분석 결과 (선택 — 넣으면 대조해 드립니다)
          </label>
          <textarea
            id="judgment"
            rows={5}
            value={judgment}
            onChange={(e) => setJudgment(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void analyze()}
          disabled={loading}
        >
          {loading ? 'AI 분석 중…' : 'AI 권리분석 시작'}
        </button>
        {error ? (
          <p className="notice-inline" style={{ color: 'var(--seal)' }}>
            {error}
          </p>
        ) : null}
        <p className="field-hint">
          필수 8항목(말소기준권리·대항력·배당요구·유치권·인수권리·최우선변제·특수조건·토지별도등기)을
          점검합니다. 요청은 서버에서만 처리되며 원본은 저장하지 않습니다.
        </p>
      </Section>

      {loading || compare?.claude ? (
        <ModelResultBlock
          result={
            compare?.claude
              ? { ...compare.claude, label: 'AI 권리분석' }
              : null
          }
          loading={loading && !compare?.claude}
          loadingTitle="AI 권리분석"
        />
      ) : null}

      <Disclaimer>
        문서 내 위험 패턴을 탐지해 정보를 제공할 뿐, 법적 판단이 아닙니다. 확인이
        필요한 항목은 반드시 원문을 직접 확인하세요. AI 결과는 참고용이며, 최종
        판단은 본인 몫입니다.
      </Disclaimer>
    </>
  );
}
