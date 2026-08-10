'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Badge } from '@/components/ui/Badge';
import { resistLabel } from '@/lib/llm/evictionPrompt';
import { ko } from '@/messages/ko';
import type { EvictionModelResult } from '@/types/case';

type Props = {
  result?: EvictionModelResult | null;
  loading?: boolean;
};

export function EvictionModelBlock({ result, loading }: Props) {
  const [copied, setCopied] = useState<'차분한 톤' | '단호한 톤' | null>(null);

  async function copyText(tone: '차분한 톤' | '단호한 톤', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tone);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  if (loading && !result) {
    return (
      <Section title="AI 명도코칭">
        <div className="analysis-loading analysis-loading-inline">
          <div className="loading-spinner" aria-hidden />
          <span className="analysis-loading-label">분석중...</span>
        </div>
      </Section>
    );
  }

  if (!result) return null;

  const calm = result.replyDrafts?.find((d) => d.tone === '차분한 톤');
  const firm = result.replyDrafts?.find((d) => d.tone === '단호한 톤');

  return (
    <div className="coach-panel" style={{ marginBottom: 36 }}>
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
          <span className="resist">
            명도저항 <b>{resistLabel(result.resistLevel)}</b>
          </span>
        ) : null}
      </div>

      {result.error ? (
        <div className="banner" style={{ background: 'var(--seal-soft)' }}>
          분석 실패: {result.error}
        </div>
      ) : (
        <>
          {result.crisisFlag ? (
            <div
              className="banner"
              style={{ background: 'var(--seal-soft)', marginBottom: 16 }}
            >
              <strong>위기 신호 감지</strong>
              {result.crisisNote ? ` — ${result.crisisNote}` : null}
              <div style={{ marginTop: 6, fontSize: 12 }}>
                명도 진행보다 안전이 우선입니다. 회신 초안은 압박 톤 없이
                작성되었습니다.
              </div>
            </div>
          ) : null}

          {result.speakerClarity === 'ambiguous' ? (
            <p className="s-note" style={{ marginBottom: 12 }}>
              화자 구분이 불명확한 부분이 있어 참고용으로만 활용하세요.
            </p>
          ) : null}

          <div
            style={{
              fontSize: 11,
              color: 'var(--slate)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
            }}
          >
            점유자 심리 분석
          </div>
          <div
            style={{
              fontSize: '13.5px',
              lineHeight: 1.75,
              marginBottom: 22,
              color: 'var(--ink-soft)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {result.situationSummary}
          </div>

          <div
            style={{
              fontSize: 11,
              color: 'var(--slate)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 14,
            }}
          >
            추천 회신 메시지
          </div>

          {calm ? (
            <Section style={{ padding: '18px 0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Badge tone="ok">차분한 톤</Badge>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => copyText('차분한 톤', calm.message)}
                >
                  {copied === '차분한 톤' ? ko.common.copied : ko.common.copy}
                </button>
              </div>
              <div className="msg them" style={{ maxWidth: '100%' }}>
                {calm.message}
              </div>
            </Section>
          ) : null}

          {firm ? (
            <Section style={{ padding: '18px 0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Badge tone="mid">단호한 톤</Badge>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => copyText('단호한 톤', firm.message)}
                >
                  {copied === '단호한 톤' ? ko.common.copied : ko.common.copy}
                </button>
              </div>
              <div className="msg them" style={{ maxWidth: '100%' }}>
                {firm.message}
              </div>
            </Section>
          ) : null}

          <div
            style={{
              fontSize: 11,
              color: 'var(--slate)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '22px 0 12px',
            }}
          >
            다음 행동 제안
          </div>
          {result.nextActions.map((action) => (
            <div
              className="checklist-item"
              style={{ padding: '9px 0' }}
              key={`${result.model}-${action}`}
            >
              <div className="chk-box" />
              <div>{action}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
