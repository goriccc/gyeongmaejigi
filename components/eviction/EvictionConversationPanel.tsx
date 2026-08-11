'use client';

import { useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Badge } from '@/components/ui/Badge';
import { resistLabel } from '@/lib/llm/evictionPrompt';
import {
  buildFullConversation,
  conversationStats,
  formatConversationEntryLabel,
} from '@/lib/eviction/conversationLog';
import type { EvictionConversationLog } from '@/types/case';

const NEW_PASTE_PLACEHOLDER = `새로 받은 메시지만 붙여넣으세요.

예)
점유자: 지난번 말씀드린 것처럼 이사 준비 중인데, 이번 주말까지는 어렵습니다.
나: 구체적으로 언제쯤 이사 가능하신지 날짜를 알려주실 수 있을까요?`;

const INITIAL_PASTE_PLACEHOLDER = `지금까지 주고받은 대화 전체를 붙여넣으세요.

예)
점유자: 안녕하세요, 낙찰받으신 분 맞으시죠. 시간을 좀 더 주실 수 있나요?
나: 네 맞습니다. 이사 계획을 구체적으로 말씀해주실 수 있을까요?`;

type Props = {
  log: EvictionConversationLog | null;
  newPaste: string;
  onNewPasteChange: (value: string) => void;
  onAppend: () => void;
  onAnalyze: () => void;
  onClearLog: () => void;
  loading: boolean;
  lastAnalyzedAt?: string;
  resistLevel?: 'low' | 'mid' | 'high';
};

export function EvictionConversationPanel({
  log,
  newPaste,
  onNewPasteChange,
  onAppend,
  onAnalyze,
  onClearLog,
  loading,
  lastAnalyzedAt,
  resistLevel,
}: Props) {
  const [logExpanded, setLogExpanded] = useState(false);
  const stats = useMemo(() => conversationStats(log), [log]);
  const fullText = useMemo(() => buildFullConversation(log), [log]);
  const hasLog = stats.entryCount > 0;

  const previewText =
    fullText.length > 420 && !logExpanded
      ? `${fullText.slice(0, 420)}…`
      : fullText;

  return (
    <>
      {hasLog ? (
        <Section
          title={`대화 기록 (${stats.entryCount}회 · ${stats.charCount.toLocaleString('ko-KR')}자)`}
          note="명도가 끝날 때까지 새 메시지를 계속 추가하면 전체 흐름을 기준으로 분석합니다."
        >
          <div className="eviction-log-meta">
            {lastAnalyzedAt ? (
              <span className="eviction-log-meta-item">
                마지막 분석{' '}
                {formatConversationEntryLabel(lastAnalyzedAt)}
              </span>
            ) : null}
            {resistLevel ? (
              <Badge tone={resistLevel === 'high' ? 'warn' : 'mid'}>
                저항 {resistLabel(resistLevel)}
              </Badge>
            ) : null}
          </div>

          <ul className="eviction-log-timeline">
            {log!.entries.map((entry, index) => (
              <li key={entry.id} className="eviction-log-timeline-item">
                <span className="eviction-log-timeline-num">{index + 1}</span>
                <span className="eviction-log-timeline-date">
                  {formatConversationEntryLabel(entry.addedAt)}
                </span>
                <span className="eviction-log-timeline-preview">
                  {entry.text.split('\n')[0]?.slice(0, 48)}
                  {entry.text.length > 48 ? '…' : ''}
                </span>
              </li>
            ))}
          </ul>

          <div className="eviction-log-body">
            <pre className="eviction-log-text">{previewText}</pre>
            {fullText.length > 420 ? (
              <button
                type="button"
                className="btn-text eviction-log-toggle"
                onClick={() => setLogExpanded((v) => !v)}
              >
                {logExpanded ? '접기' : '전체 보기'}
              </button>
            ) : null}
          </div>

          <div className="eviction-log-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClearLog}
              disabled={loading}
            >
              대화 기록 삭제
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onAnalyze}
              disabled={loading}
            >
              {loading ? '분석 중…' : '전체 재분석'}
            </button>
          </div>
        </Section>
      ) : null}

      <Section
        title={hasLog ? '새 대화 추가' : '대화 시작'}
        note={
          hasLog
            ? '카카오톡·문자에서 새로 받은 메시지만 복사해 붙여넣으세요. 전체 대화를 다시 붙여넣으면 자동으로 통합됩니다.'
            : '점유자와 나눈 문자·카카오톡 대화를 그대로 붙여넣으세요. 화자 구분은 자동으로 인식합니다.'
        }
      >
        <div className="field">
          <textarea
            id="pasteInput"
            className="eviction-paste-input"
            value={newPaste}
            onChange={(e) => onNewPasteChange(e.target.value)}
            placeholder={
              hasLog ? NEW_PASTE_PLACEHOLDER : INITIAL_PASTE_PLACEHOLDER
            }
          />
        </div>

        <div className="eviction-paste-actions">
          {hasLog ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onAppend}
              disabled={loading || !newPaste.trim()}
            >
              추가만
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAnalyze}
            disabled={
              loading || (!newPaste.trim() && !hasLog)
            }
          >
            {loading
              ? 'AI 분석 중…'
              : hasLog
                ? newPaste.trim()
                  ? '추가하고 재분석'
                  : '전체 재분석'
                : '저장하고 분석'}
          </button>
        </div>

        <p className="field-hint">
          대화 원문은 이 기기·사건에만 저장됩니다. 다른 기기와는 공유되지
          않습니다.
        </p>
      </Section>
    </>
  );
}
