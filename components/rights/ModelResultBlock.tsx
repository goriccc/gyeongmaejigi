'use client';

import { Section } from '@/components/ui/Section';
import { RiskRow } from '@/components/ui/RiskRow';
import { RichNote } from '@/components/ui/RichNote';
import type { BadgeTone } from '@/components/ui/Badge';
import type { ModelAnalysisResult, RiskFlag } from '@/types/case';

function statusBadge(flag: RiskFlag): { label: string; tone: BadgeTone } {
  if (flag.label.includes('최우선변제')) {
    if (flag.eligibility === '해당없음') {
      // 해당없음은 본인 분석 언급 없어도 초록
      return { label: '해당없음', tone: 'ok' };
    }
    if (flag.eligibility === '해당') {
      // 해당 + 본인 분석에 언급 있으면 초록, 없으면 붉은 계열
      return {
        label: '해당',
        tone: flag.userMentioned ? 'ok' : 'warn',
      };
    }
    return { label: '확인필요', tone: 'warn' };
  }
  if (flag.status === 'warning') return { label: '확인필요', tone: 'warn' };
  if (flag.status === 'mismatch') return { label: '불일치', tone: 'warn' };
  if (flag.label.includes('말소기준')) {
    return { label: '일치', tone: 'ok' };
  }
  // 대항력: 본인 판단과 결론이 같으면 일치, 본인 분석 없으면 양호
  if (flag.label.includes('대항력') && flag.status === 'ok') {
    return {
      label: flag.userMentioned ? '일치' : '양호',
      tone: 'ok',
    };
  }
  if (flag.status === 'ok') return { label: '양호', tone: 'ok' };
  return { label: '양호', tone: 'ok' };
}

type Props = {
  result?: ModelAnalysisResult | null;
  loading?: boolean;
  /** 로딩 중 섹션 제목 */
  loadingTitle?: string;
};

export function ModelResultBlock({
  result,
  loading,
  loadingTitle = '분석중...',
}: Props) {
  if (loading && !result) {
    return (
      <Section title={loadingTitle}>
        <div className="analysis-loading analysis-loading-inline">
          <div className="loading-spinner" aria-hidden />
          <span className="analysis-loading-label">분석중...</span>
        </div>
      </Section>
    );
  }

  if (!result) return null;

  return (
    <Section
      title={
        <>
          {result.label}
          {result.latencyMs != null ? (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--slate)',
                fontWeight: 400,
              }}
            >
              {Math.round(result.latencyMs / 100) / 10}s
            </span>
          ) : null}
        </>
      }
    >
      {result.error ? (
        <div className="banner" style={{ background: 'var(--seal-soft)' }}>
          분석 실패: {result.error}
        </div>
      ) : (
        <>
          {(result.documentsProvided?.length ||
            result.documentsMissing?.length) && (
            <p className="s-note" style={{ marginBottom: 12 }}>
              {result.documentsProvided?.length
                ? `제공 문서: ${result.documentsProvided.join(', ')}`
                : null}
              {result.documentsProvided?.length &&
              result.documentsMissing?.length
                ? ' · '
                : null}
              {result.documentsMissing?.length
                ? `미제공: ${result.documentsMissing.join(', ')}`
                : null}
            </p>
          )}
          {result.summary ? (
            <p className="s-note" style={{ marginBottom: 18 }}>
              {result.summary}
            </p>
          ) : null}
          {result.riskFlags.map((flag) => {
            const badge = statusBadge(flag);
            const noteParts = [flag.note];
            if (flag.sourceQuote) {
              noteParts.push(`원문: “${flag.sourceQuote}”`);
            }
            const isPriority = flag.label.includes('최우선변제');
            const noteText = noteParts.filter(Boolean).join(' ');
            return (
              <RiskRow
                key={`${result.model}-${flag.label}`}
                name={flag.label}
                note={<RichNote text={noteText} />}
                badge={badge.label}
                badgeTone={badge.tone}
                diffTag={
                  isPriority
                    ? flag.eligibility === '해당없음'
                      ? undefined
                      : flag.eligibility === '해당'
                        ? flag.userMentioned
                          ? '본인 분석에 최우선변제 언급 있음'
                          : '본인 분석에 최우선변제 언급 없음'
                        : undefined
                    : flag.status === 'mismatch'
                      ? flag.userMismatch || '본인 판단과 다름'
                      : flag.status === 'warning'
                        ? '확인필요'
                        : undefined
                }
                diffTone={
                  isPriority
                    ? flag.eligibility === '해당' && flag.userMentioned
                      ? 'ok'
                      : 'warn'
                    : 'warn'
                }
              />
            );
          })}
        </>
      )}
    </Section>
  );
}
