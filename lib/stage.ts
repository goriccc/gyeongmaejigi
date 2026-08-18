import type { CaseFile, CaseStage, CaseTrack } from '@/types/case';
import { isRegisteredPostWin, normalizeCaseTrack } from '@/lib/caseUtils';

export type ChapterKey = 'dashboard' | 'A' | 'B' | 'C' | 'D' | 'F' | 'E';

export type ChapterProgress =
  | '완료'
  | '진행중'
  | '시작 전'
  | '해당 없음'
  | '건너뜀';

const STAGE_ORDER: CaseStage[] = ['A', 'B', 'C', 'D', 'F', 'E', 'done'];

function stageIndex(stage: CaseStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function hasReverseCalcInputs(caseFile: CaseFile): boolean {
  const saved = caseFile.bidCalcInputs;
  return saved != null && saved.sellPrice > 0;
}

function getPostWinChapterProgress(
  caseFile: CaseFile,
  chapter: Exclude<ChapterKey, 'dashboard'>,
): ChapterProgress {
  const goals = caseFile.postWinGoals;
  if (chapter === 'A') return '완료';
  if (chapter === 'B') {
    return caseFile.rightsAnalysis?.analyzedAt ? '완료' : '건너뜀';
  }
  if (chapter === 'C') {
    return caseFile.fieldBriefing ? '완료' : '건너뜀';
  }
  if (chapter === 'D') {
    return hasReverseCalcInputs(caseFile) ? '완료' : '건너뜀';
  }
  if (chapter === 'F') {
    if (!goals?.loanCompare) return '건너뜀';
    if (caseFile.stage === 'E' || caseFile.stage === 'done') return '완료';
    if (caseFile.stage === 'F') return '진행중';
    return '시작 전';
  }
  if (chapter === 'E') {
    if (!goals?.eviction) return '건너뜀';
    if (caseFile.stage === 'done') return '완료';
    if (caseFile.stage === 'E') return '진행중';
    return '시작 전';
  }
  return '해당 없음';
}

/**
 * 현재 stage·track 기준으로 각 장의 진행 상태를 반환합니다.
 */
export function getChapterProgress(
  stage: CaseStage,
  chapter: Exclude<ChapterKey, 'dashboard'>,
  track: CaseTrack = 'bidding',
): ChapterProgress {
  if (track === 'eviction') {
    if (chapter === 'E') {
      if (stage === 'done') return '완료';
      return '진행중';
    }
    return '건너뜀';
  }

  if (stage === 'done') {
    return '완료';
  }

  if (chapter === 'E') {
    if (stage === 'E') return '진행중';
    return '시작 전';
  }

  const current = stageIndex(stage);
  const target = stageIndex(chapter);

  if (target < current) return '완료';
  if (target === current) return '진행중';
  return '시작 전';
}

export function getCaseChapterProgress(
  caseFile: CaseFile,
  chapter: Exclude<ChapterKey, 'dashboard'>,
): ChapterProgress {
  if (isRegisteredPostWin(caseFile)) {
    return getPostWinChapterProgress(caseFile, chapter);
  }
  return getChapterProgress(
    caseFile.stage,
    chapter,
    normalizeCaseTrack(caseFile),
  );
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

/** 대출상품 비교 저장 시 D→F (낙찰 전에도 입력 가능) */
export function afterLoanCompareSaved(stage: CaseStage): CaseStage {
  return promoteStage(stage, 'F');
}

export function stageBadgeLabel(caseFile: CaseFile): string {
  const track = normalizeCaseTrack(caseFile);

  if (caseFile.stage === 'done') {
    return track === 'eviction' ? '명도 완료' : '입찰 · 명도 완료';
  }

  if (track === 'eviction') {
    return '명도 · 진행중';
  }

  if (caseFile.bidOutcome === 'lost') return '유찰';
  if (caseFile.bidOutcome === 'skipped') return '입찰 안 함';

  switch (caseFile.stage) {
    case 'A':
      return '제1장 · 입찰사건';
    case 'B':
      return '제2장 · 대조체크중';
    case 'C':
      return '제3장 · 임장준비';
    case 'D':
      return '제4장 · 입찰가계산';
    case 'F':
      return '제5장 · 대출비교';
    case 'E':
      return '제6장 · 명도코칭';
    default:
      return caseFile.stage;
  }
}
