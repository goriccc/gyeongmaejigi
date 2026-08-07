import type { CaseFile, CaseStage } from '@/types/case';

export type ChapterKey = 'dashboard' | 'A' | 'B' | 'C' | 'D' | 'E';

export type ChapterProgress = '완료' | '진행중' | '시작 전' | '해당 없음';

const STAGE_ORDER: CaseStage[] = ['A', 'B', 'C', 'D', 'E', 'done'];

function stageIndex(stage: CaseStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/**
 * 현재 stage 기준으로 각 장의 진행 상태를 반환합니다.
 * D→E 전환 전에는 제5장이 "해당 없음"입니다.
 */
export function getChapterProgress(
  stage: CaseStage,
  chapter: Exclude<ChapterKey, 'dashboard'>,
): ChapterProgress {
  if (stage === 'done') {
    return '완료';
  }

  if (chapter === 'E') {
    if (stage === 'E') return '진행중';
    return '해당 없음';
  }

  const current = stageIndex(stage);
  const target = stageIndex(chapter);

  if (target < current) return '완료';
  if (target === current) return '진행중';
  return '시작 전';
}

/**
 * 자동 승격 규칙에 따라 stage를 올립니다. (후퇴하지 않음)
 */
export function promoteStage(
  current: CaseStage,
  next: CaseStage,
): CaseStage {
  if (stageIndex(next) > stageIndex(current)) return next;
  return current;
}

/** entryMatchResult 저장 시 A→B */
export function afterEntryMatchSaved(stage: CaseStage): CaseStage {
  return promoteStage(stage, 'B');
}

/** riskFlags 저장 시 B→C */
export function afterRiskFlagsSaved(stage: CaseStage): CaseStage {
  return promoteStage(stage, 'C');
}

/** 모듈 D 첫 입력 저장 시 C→D */
export function afterBidCalcSaved(stage: CaseStage): CaseStage {
  return promoteStage(stage, 'D');
}

export function stageBadgeLabel(caseFile: CaseFile): string {
  switch (caseFile.stage) {
    case 'A':
      return '제1장 · 진입매칭';
    case 'B':
      return '제2장 · 대조체크중';
    case 'C':
      return '제3장 · 임장준비';
    case 'D':
      return '제4장 · 입찰가계산';
    case 'E':
      return '제5장 · 명도코칭';
    case 'done':
      return '명도 완료';
    default:
      return caseFile.stage;
  }
}
