'use client';

import { useEffect, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { EvictionModelBlock } from '@/components/eviction/EvictionModelBlock';
import { useCases } from '@/lib/hooks/useCases';
import { readJsonSafe } from '@/lib/http/readJsonSafe';
import { readNdjsonStream } from '@/lib/http/readNdjsonStream';
import { ko } from '@/messages/ko';
import type { EvictionCoachCompare, EvictionModelResult } from '@/types/case';

type EvictionStreamEvent =
  | { type: 'result'; result: EvictionModelResult }
  | { type: 'done'; analyzedAt: string }
  | { type: 'error'; error: string };

const DEFAULT_PASTE = `점유자: 안녕하세요, 낙찰받으신 분 맞으시죠. 저 이사 갈 데를 아직 못 구했는데... 시간을 좀 더 주실 수 있나요?
나: 네 맞습니다. 상황은 이해합니다만 잔금일이 정해져 있어서요. 이사 계획을 좀 더 구체적으로 말씀해주실 수 있을까요?
점유자: 한 달 정도만 더 여유를 주시면 안될까요? 저도 이사 갈 형편이 넉넉지 않아서 걱정이 많아요.`;

type ContentProofModelResult = {
  model: 'claude-sonnet-5';
  label: string;
  title: string;
  body: string;
  caution: string;
  latencyMs?: number;
  error?: string;
};

type ContentProofCompare = {
  claude?: ContentProofModelResult;
  result?: ContentProofModelResult;
  analyzedAt: string;
};

function ContentProofBlock({
  result,
  loading,
}: {
  result?: ContentProofModelResult | null;
  loading?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyBody() {
    if (!result?.body) return;
    try {
      await navigator.clipboard.writeText(
        `${result.title}\n\n${result.body}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (loading && !result) {
    return (
      <Section title="AI 내용증명">
        <div className="analysis-loading analysis-loading-inline">
          <div className="loading-spinner" aria-hidden />
          <span className="analysis-loading-label">분석중...</span>
        </div>
      </Section>
    );
  }

  if (!result) return null;

  return (
    <div className="coach-panel" style={{ marginBottom: 28 }}>
      <div className="coach-head">
        <h3>
          {result.label}
          {result.latencyMs != null ? (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--slate)',
                fontWeight: 400,
                marginLeft: 10,
              }}
            >
              {Math.round(result.latencyMs / 100) / 10}s
            </span>
          ) : null}
        </h3>
        {!result.error ? (
          <button type="button" className="btn-text" onClick={() => void copyBody()}>
            {copied ? ko.common.copied : ko.common.copy}
          </button>
        ) : null}
      </div>

      {result.error ? (
        <div className="banner" style={{ background: 'var(--seal-soft)' }}>
          작성 실패: {result.error}
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
              color: 'var(--ink)',
            }}
          >
            {result.title}
          </div>
          <div
            className="modal-body"
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: '13.5px',
              lineHeight: 1.75,
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {result.body}
          </div>
          {result.caution ? (
            <p className="notice-inline" style={{ marginTop: 12 }}>
              {result.caution}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function EvictionCoachPage() {
  const { activeCase, updateCase } = useCases();
  const [paste, setPaste] = useState(DEFAULT_PASTE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compare, setCompare] = useState<EvictionCoachCompare | null>(
    activeCase?.evictionCoach ?? null,
  );
  const [certOpen, setCertOpen] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState('');
  const [certCompare, setCertCompare] = useState<ContentProofCompare | null>(
    null,
  );

  useEffect(() => {
    if (activeCase?.evictionCoach) {
      setCompare(activeCase.evictionCoach);
    }
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function persistEviction(next: EvictionCoachCompare) {
    if (!activeCase) return;
    const primary = next.claude;
    if (primary && !primary.error) {
      updateCase(activeCase.id, {
        evictionCoach: next,
        evictionSummary: {
          resistLevel: primary.resistLevel,
          nextActions: primary.nextActions,
        },
      });
    } else {
      updateCase(activeCase.id, { evictionCoach: next });
    }
  }

  async function analyze() {
    setLoading(true);
    setError('');
    setCompare({ analyzedAt: new Date().toISOString() });
    setCertCompare(null);
    try {
      const res = await fetch('/api/eviction-coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversation: paste }),
        signal: AbortSignal.timeout(100_000),
      });
      if (!res.ok && !res.body) {
        throw new Error('분석 요청에 실패했습니다.');
      }

      let latest: EvictionCoachCompare = {
        analyzedAt: new Date().toISOString(),
      };

      await readNdjsonStream<EvictionStreamEvent>(res, (event) => {
        if (event.type === 'error') {
          throw new Error(event.error || '분석 요청에 실패했습니다.');
        }
        if (event.type === 'result') {
          latest = {
            ...latest,
            claude: { ...event.result, label: 'AI 명도코칭' },
          };
          setCompare(latest);
          persistEviction(latest);
        }
        if (event.type === 'done') {
          latest = { ...latest, analyzedAt: event.analyzedAt };
          setCompare(latest);
          persistEviction(latest);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function openContentProof(force = false) {
    setCertOpen(true);
    setCertError('');
    if (certCompare && !force) return;

    setCertCompare(null);
    setCertLoading(true);
    try {
      const res = await fetch('/api/content-proof', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversation: paste }),
        signal: AbortSignal.timeout(100_000),
      });
      const data = await readJsonSafe<
        ContentProofCompare & {
          result?: ContentProofModelResult;
          error?: string;
        }
      >(res);
      if (!res.ok) {
        throw new Error(data.error || '내용증명 초안 작성에 실패했습니다.');
      }
      const result = data.result ?? data.claude;
      if (!result) {
        throw new Error('내용증명 초안 응답이 비어 있습니다.');
      }
      setCertCompare({
        result: { ...result, label: 'AI 내용증명' },
        claude: { ...result, label: 'AI 내용증명' },
        analyzedAt: data.analyzedAt,
      });
    } catch (err) {
      setCertError(
        err instanceof Error
          ? err.message
          : '내용증명 초안 작성 중 오류가 발생했습니다.',
      );
    } finally {
      setCertLoading(false);
    }
  }

  function completeEviction() {
    if (!activeCase) return;
    updateCase(activeCase.id, { stage: 'done' });
  }

  return (
    <>
      <div className="chapter-mark">제5장 · 명도 코칭</div>
      <h1 className="page-title">
        대화를 붙여넣으면,
        <br />
        <em>다음 회신</em>을 제안합니다.
      </h1>
      <p className="page-sub">
        점유자와 나눈 문자·카카오톡 대화를 그대로 복사해 붙여넣으세요. AI가
        점유자 심리 분석과 회신 초안을 제안합니다. 법적 자문이 아닌 협상 방향
        안내입니다.
      </p>

      {activeCase?.stage !== 'E' && activeCase?.stage !== 'done' ? (
        <div className="banner">
          명도 단계는 낙찰 후 제4장에서 &quot;낙찰됨 · 명도 단계로 전환&quot;
          버튼을 눌러 진입합니다.
        </div>
      ) : null}

      <Section
        title="대화 내용 붙여넣기"
        note="문자·카카오톡에서 복사한 대화를 그대로 붙여넣으면 됩니다. 화자 구분은 자동으로 인식합니다."
      >
        <div className="field">
          <textarea
            id="pasteInput"
            style={{ minHeight: 150 }}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={`예)\n점유자: ...\n나: ...`}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void analyze()}
          disabled={loading || !paste.trim()}
        >
          {loading ? 'AI 분석 중…' : '대화 분석하기'}
        </button>
        {error ? (
          <p className="notice-inline" style={{ color: 'var(--seal)' }}>
            {error}
          </p>
        ) : null}
        <p className="field-hint">
          붙여넣은 대화 원문은 저장되지 않습니다.
        </p>
      </Section>

      {loading || compare?.claude ? (
        <>
          <div className="chapter-mark" style={{ marginTop: 8 }}>
            AI 명도코칭 결과
          </div>
          <EvictionModelBlock
            result={
              compare?.claude
                ? { ...compare.claude, label: 'AI 명도코칭' }
                : null
            }
            loading={loading && !compare?.claude}
          />
        </>
      ) : null}

      {compare && !loading ? (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 22,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => void openContentProof()}
              disabled={!paste.trim()}
            >
              내용증명 초안 보기
            </button>
          </div>

          {activeCase?.stage === 'E' ? (
            <div style={{ marginTop: 28 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={completeEviction}
              >
                {ko.common.completeEviction}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Disclaimer>
        저항 등급과 회신 초안은 확률이 아닌 대화 맥락 기반 추정입니다. 붙여넣은
        대화는 저장되지 않으며, 강제집행 등 실제 법적 절차는 전문가 확인이
        필요합니다. AI 결과는 참고용입니다.
      </Disclaimer>

      {certOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 720, width: '92vw' }}>
            <h3>AI 내용증명 초안</h3>
            <p className="s-note" style={{ marginBottom: 16 }}>
              발송 전 전문가 검토가 필요합니다.
            </p>

            {certError ? (
              <p className="notice-inline" style={{ color: 'var(--seal)' }}>
                {certError}
              </p>
            ) : null}

            <ContentProofBlock
              result={certCompare?.result ?? certCompare?.claude ?? null}
              loading={certLoading}
            />

            <div className="modal-actions">
              {certError ||
              (certCompare &&
                (certCompare.result ?? certCompare.claude)?.error) ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => void openContentProof(true)}
                  disabled={certLoading}
                >
                  다시 작성
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCertOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
