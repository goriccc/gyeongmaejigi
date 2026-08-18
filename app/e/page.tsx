'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EvictionConversationPanel } from '@/components/eviction/EvictionConversationPanel';
import { EvictionModelBlock } from '@/components/eviction/EvictionModelBlock';
import { Section } from '@/components/ui/Section';
import { useCases } from '@/lib/hooks/useCases';
import {
  appendToConversationLog,
  buildFullConversation,
  trimConversationForApi,
} from '@/lib/eviction/conversationLog';
import { readJsonSafe } from '@/lib/http/readJsonSafe';
import { readNdjsonStream } from '@/lib/http/readNdjsonStream';
import { ko } from '@/messages/ko';
import { isContentProofStale } from '@/lib/eviction/contentProofStale';
import { normalizeCaseTrack } from '@/lib/caseUtils';
import type {
  ContentProofCompare,
  ContentProofModelResult,
  EvictionCoachCompare,
  EvictionConversationLog,
  EvictionModelResult,
} from '@/types/case';

type EvictionStreamEvent =
  | { type: 'result'; result: EvictionModelResult }
  | { type: 'done'; analyzedAt: string }
  | { type: 'error'; error: string };

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
  const [conversationLog, setConversationLog] =
    useState<EvictionConversationLog | null>(null);
  const [newPaste, setNewPaste] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compare, setCompare] = useState<EvictionCoachCompare | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState('');
  const [certCompare, setCertCompare] = useState<ContentProofCompare | null>(
    null,
  );

  const fullConversation = useMemo(
    () => buildFullConversation(conversationLog),
    [conversationLog],
  );

  useEffect(() => {
    setConversationLog(activeCase?.evictionConversationLog ?? null);
    setNewPaste('');
    setCompare(activeCase?.evictionCoach ?? null);
    setError('');

    const proof = activeCase?.contentProof;
    if (
      activeCase &&
      proof &&
      isContentProofStale(
        proof,
        activeCase.evictionCoach,
        activeCase.evictionConversationLog,
      )
    ) {
      setCertCompare(null);
      updateCase(activeCase.id, { contentProof: undefined });
      return;
    }
    setCertCompare(proof ?? null);
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistLog = useCallback(
    (log: EvictionConversationLog) => {
      setConversationLog(log);
      setCertCompare(null);
      if (activeCase) {
        updateCase(activeCase.id, {
          evictionConversationLog: log,
          contentProof: undefined,
        });
      }
    },
    [activeCase, updateCase],
  );

  function persistEviction(next: EvictionCoachCompare) {
    if (!activeCase) return;
    const primary = next.claude;
    const patch: Parameters<typeof updateCase>[1] = {
      evictionCoach: next,
      contentProof: undefined,
    };
    if (primary && !primary.error) {
      patch.evictionSummary = {
        resistLevel: primary.resistLevel,
        nextActions: primary.nextActions,
      };
    }
    setCertCompare(null);
    updateCase(activeCase.id, patch);
  }

  async function runAnalysis(conversation: string) {
    const payload = trimConversationForApi(conversation);
    setLoading(true);
    setError('');
    setCompare({ analyzedAt: new Date().toISOString() });
    setCertCompare(null);
    if (activeCase?.contentProof) {
      updateCase(activeCase.id, { contentProof: undefined });
    }
    try {
      const res = await fetch('/api/eviction-coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversation: payload }),
        signal: AbortSignal.timeout(120_000),
      });

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

  function handleAppend() {
    const { log, merged } = appendToConversationLog(conversationLog, newPaste);
    if (merged === 'skip') return;
    persistLog(log);
    setNewPaste('');
  }

  function handleAnalyze() {
    let log = conversationLog;
    if (newPaste.trim()) {
      const result = appendToConversationLog(log, newPaste);
      log = result.log;
      if (result.merged !== 'skip') {
        persistLog(log);
        setNewPaste('');
      }
    }
    const conversation = buildFullConversation(log);
    if (!conversation.trim()) return;
    void runAnalysis(conversation);
  }

  function handleClearLog() {
    if (
      !window.confirm(
        '저장된 대화 기록을 모두 삭제할까요? 분석 결과는 유지됩니다.',
      )
    ) {
      return;
    }
    persistLog({ entries: [], updatedAt: new Date().toISOString() });
    setNewPaste('');
  }

  async function openContentProof(force = false) {
    setCertOpen(true);
    setCertError('');
    if (certCompare && !force) return;

    const conversation = trimConversationForApi(fullConversation);
    if (!conversation.trim()) {
      setCertError('분석할 대화 기록이 없습니다.');
      return;
    }

    setCertCompare(null);
    setCertLoading(true);
    try {
      const res = await fetch('/api/content-proof', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversation }),
        signal: AbortSignal.timeout(120_000),
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
      const next: ContentProofCompare = {
        result: { ...result, label: 'AI 내용증명' },
        claude: { ...result, label: 'AI 내용증명' },
        analyzedAt: data.analyzedAt,
      };
      setCertCompare(next);
      if (activeCase) {
        updateCase(activeCase.id, { contentProof: next });
      }
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

  function promoteToE() {
    if (!activeCase) return;
    updateCase(activeCase.id, { stage: 'E', bidOutcome: 'won' });
  }

  function renderEvictionBanner() {
    if (!activeCase) {
      return (
        <div className="banner banner-soft">{ko.evictionBanner.noCase}</div>
      );
    }

    const track = normalizeCaseTrack(activeCase);

    if (track === 'eviction') {
      return (
        <div className="banner banner-soft">{ko.evictionBanner.ready}</div>
      );
    }

    if (activeCase.stage === 'E' || activeCase.stage === 'done') {
      return null;
    }

    return (
      <div className="banner">
        {ko.evictionBanner.biddingPrep}
        {activeCase.stage === 'D' || activeCase.stage === 'F' ? (
          <>
            {' '}
            <button
              type="button"
              className="btn-text banner-inline-btn"
              onClick={promoteToE}
            >
              {ko.evictionBanner.promote}
            </button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="chapter-mark">제6장 · 명도 코칭</div>
      <h1 className="page-title">
        대화를 쌓아가며,
        <br />
        <em>다음 회신</em>을 제안합니다.
      </h1>
      <p className="page-sub">
        점유자와 나눈 문자·카카오톡을 붙여넣으면 사건별로 대화가 누적됩니다.
        명도가 끝날 때까지 새 메시지를 추가하고 재분석하면 전체 흐름을 기준으로
        심리 분석과 회신 초안을 받을 수 있습니다.
      </p>

      {renderEvictionBanner()}

      <EvictionConversationPanel
        log={conversationLog}
        newPaste={newPaste}
        onNewPasteChange={setNewPaste}
        onAppend={handleAppend}
        onAnalyze={handleAnalyze}
        onClearLog={handleClearLog}
        loading={loading}
        lastAnalyzedAt={compare?.analyzedAt}
        resistLevel={compare?.claude?.resistLevel}
      />

      {error ? (
        <p className="notice-inline" style={{ color: 'var(--seal)' }}>
          {error}
        </p>
      ) : null}

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
              disabled={!fullConversation.trim()}
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
