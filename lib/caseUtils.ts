import type { CaseFile, CaseTrack, PostWinGoals } from '@/types/case';
import { resolveBidDeposit } from '@/lib/auction/bidDeposit';
import { formatAuctionRoundLabel } from '@/lib/auction/auctionRound';

export type CaseNextAction = {
  href: string;
  label: string;
};

export type CaseGroups = {
  thisWeek: CaseFile[];
  reviewing: CaseFile[];
  postWin: CaseFile[];
  eviction: CaseFile[];
  archived: CaseFile[];
};

const MS_DAY = 86_400_000;

export function normalizeCaseTrack(c: CaseFile): CaseTrack {
  return c.track ?? 'bidding';
}

export function isEvictionCase(c: CaseFile): boolean {
  const track = normalizeCaseTrack(c);
  return track === 'eviction' || c.stage === 'E' || c.stage === 'done';
}

export function isRegisteredPostWin(c: CaseFile): boolean {
  return normalizeCaseTrack(c) === 'bidding' && c.postWinGoals != null;
}

export function isPostWinCase(c: CaseFile): boolean {
  return (
    normalizeCaseTrack(c) === 'bidding' &&
    c.bidOutcome === 'won' &&
    c.stage !== 'done'
  );
}

export function isAuctionDatePast(iso: string): boolean {
  const dday = daysUntilAuction(iso);
  return dday != null && dday < 0;
}

export function postWinLandingHref(goals: PostWinGoals): string {
  return goals.loanCompare ? '/f' : '/e';
}

export function isArchivedCase(c: CaseFile): boolean {
  if (c.stage === 'done') return true;
  if (normalizeCaseTrack(c) === 'bidding') {
    if (c.bidOutcome === 'lost' || c.bidOutcome === 'skipped') return true;
    if (
      (c.bidOutcome === 'pending' || !c.bidOutcome) &&
      isAuctionDatePast(c.auctionDate)
    ) {
      return true;
    }
  }
  return false;
}

export function parseAuctionTime(iso: string): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function daysUntilAuction(iso: string): number | null {
  const t = parseAuctionTime(iso);
  if (!Number.isFinite(t)) return null;
  const diff = t - Date.now();
  return Math.ceil(diff / MS_DAY);
}

export function formatAuctionDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}`;
}

export function trackLabel(track: CaseTrack): string {
  return track === 'eviction' ? '명도' : '입찰 준비';
}

export function caseBadgeLabel(c: CaseFile): string {
  if (normalizeCaseTrack(c) === 'eviction') return '명도';
  if (c.stage === 'done') return '완료';
  if (c.bidOutcome === 'lost') return '유찰';
  if (c.bidOutcome === 'skipped') return '입찰 안 함';
  if (c.bidOutcome === 'won') {
    const g = c.postWinGoals;
    if (g?.loanCompare && g.eviction) return '낙찰 · 대출·명도';
    if (g?.loanCompare) return '낙찰 · 대출';
    if (g?.eviction) return '낙찰 · 명도';
    return '낙찰';
  }
  if (isArchivedCase(c)) return '기일 경과';
  return '입찰';
}

export function caseBadgeTone(
  c: CaseFile,
): 'ok' | 'warn' | 'mid' | 'neutral' {
  if (normalizeCaseTrack(c) === 'eviction') return 'mid';
  if (c.bidOutcome === 'won') return 'ok';
  if (c.bidOutcome === 'lost' || isArchivedCase(c)) return 'warn';
  return 'neutral';
}

export function caseDisplayName(c: CaseFile): string {
  if (c.clientLabel?.trim()) {
    return `${c.name.trim()} (${c.clientLabel.trim()})`;
  }
  return c.name;
}

/** 사건번호 + 물건번호 표시 (예: 2026타경1234 · 1) */
export function formatCaseNumberWithProperty(c: CaseFile): string {
  const cn = c.caseNumber?.trim();
  if (!cn) return '';
  const prop = c.propertyNumber ?? 1;
  return `${cn} · ${prop}`;
}

export function caseMetaLine(c: CaseFile): string {
  const parts: string[] = [];
  if (c.address?.trim()) parts.push(c.address.trim());
  const caseNo = formatCaseNumberWithProperty(c);
  if (caseNo) parts.push(caseNo);
  parts.push(...caseMetaStats(c));
  return parts.join(' · ');
}

/** 입찰사건 카드 — 주소·사건번호는 별도 표시 */
export function caseTaskMetaLine(c: CaseFile): string {
  return caseTaskMetaStats(c).join(' · ');
}

function formatMetaAmount(prefix: string, value: number): string {
  const eok = value / 100_000_000;
  if (eok >= 1) {
    return `${prefix} ${eok.toFixed(2).replace(/\.?0+$/, '')}억`;
  }
  if (value >= 10_000) {
    return `${prefix} ${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
  }
  return `${prefix} ${value.toLocaleString('ko-KR')}원`;
}

function formatDepositAmount(value: number): string {
  const eok = value / 100_000_000;
  if (eok >= 1) {
    return `${eok.toFixed(2).replace(/\.?0+$/, '')}억`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
  }
  return `${value.toLocaleString('ko-KR')}원`;
}

function caseTaskMetaStats(c: CaseFile): string[] {
  const parts: string[] = [];
  if (c.appraisalValue > 0) {
    parts.push(formatMetaAmount('감정가', c.appraisalValue));
  }
  if (c.auctionRound && c.auctionRound > 0) {
    parts.push(formatAuctionRoundLabel(c.auctionRound));
  }
  if (c.minimumSalePrice && c.minimumSalePrice > 0) {
    parts.push(formatMetaAmount('최저가', c.minimumSalePrice));
  }
  const deposit = resolveBidDeposit({
    appraisalValue: c.appraisalValue,
    minimumSalePrice: c.minimumSalePrice,
    depositRate: c.bidDepositRate ?? 10,
  });
  if (deposit.amount > 0 && c.bidOutcome !== 'won') {
    parts.push(`보증금 ${formatDepositAmount(deposit.amount)} (${deposit.rate}%)`);
  }
  if (c.winningBidWon && c.winningBidWon > 0) {
    parts.push(formatMetaAmount('낙찰가', c.winningBidWon));
  }
  if (c.auctionDate) {
    parts.push(`매각 ${formatAuctionDateShort(c.auctionDate)}`);
  } else if (normalizeCaseTrack(c) === 'eviction') {
    parts.push('명도 전용');
  }
  return parts;
}

function caseMetaStats(c: CaseFile): string[] {
  const parts: string[] = [];
  if (c.appraisalValue > 0) {
    const eok = c.appraisalValue / 100_000_000;
    parts.push(
      eok >= 1
        ? `감정가 ${eok.toFixed(2).replace(/\.?0+$/, '')}억`
        : `감정가 ${c.appraisalValue.toLocaleString('ko-KR')}원`,
    );
  }
  if (c.auctionDate) {
    parts.push(`매각 ${formatAuctionDateShort(c.auctionDate)}`);
  } else if (normalizeCaseTrack(c) === 'eviction') {
    parts.push('명도 전용');
  }
  return parts;
}

/** 다음 할 일 — 홈·컨텍스트 바용 */
export function getNextAction(c: CaseFile): CaseNextAction {
  const track = normalizeCaseTrack(c);

  if (c.stage === 'done') {
    return { href: '/e', label: '명도 기록 보기' };
  }

  if (track === 'eviction') {
    return { href: '/e', label: '명도 코칭' };
  }

  if (c.bidOutcome === 'won') {
    const goals = c.postWinGoals;
    if (goals) {
      if (goals.loanCompare && !goals.eviction) {
        return { href: '/f', label: '대출상품 비교' };
      }
      if (!goals.loanCompare && goals.eviction) {
        return { href: '/e', label: '명도 코칭' };
      }
      if (c.stage === 'E') {
        return { href: '/e', label: '명도 코칭' };
      }
      return { href: '/f', label: '대출상품 비교' };
    }
    if (c.stage === 'E') {
      return { href: '/e', label: '명도 코칭' };
    }
    return { href: '/f', label: '대출상품 비교' };
  }

  if (!c.entryMatchResult) {
    return { href: '/b', label: '권리분석' };
  }
  if (!c.rightsAnalysis?.analyzedAt && c.riskFlags.length === 0) {
    return { href: '/b', label: '권리분석' };
  }
  if (c.stage === 'B') {
    return { href: '/c', label: '임장 준비' };
  }
  if (c.stage === 'C') {
    if (!c.bidCalcInputs) {
      return { href: '/d', label: '입찰가 계산' };
    }
  }
  if (c.stage === 'D' || c.bidCalcInputs) {
    if (c.bidOutcome === 'pending' || !c.bidOutcome) {
      return { href: '/d', label: '입찰가 확인' };
    }
  }

  if (c.stage === 'F') {
    return { href: '/f', label: '대출상품 비교' };
  }

  const order = ['A', 'B', 'C', 'D', 'F', 'E'] as const;
  const idx = order.indexOf(c.stage as (typeof order)[number]);
  const next = order[Math.min(idx + 1, order.length - 1)];
  const hrefMap = {
    A: '/a',
    B: '/b',
    C: '/c',
    D: '/d',
    F: '/f',
    E: '/e',
  } as const;
  const labelMap = {
    A: '입찰사건',
    B: '권리분석',
    C: '임장 준비',
    D: '입찰가 계산',
    F: '대출상품 비교',
    E: '명도 코칭',
  } as const;
  return { href: hrefMap[next], label: labelMap[next] };
}

export function groupCases(cases: CaseFile[]): CaseGroups {
  const archived: CaseFile[] = [];
  const eviction: CaseFile[] = [];
  const postWin: CaseFile[] = [];
  const biddingPrep: CaseFile[] = [];

  for (const c of cases) {
    if (isArchivedCase(c)) {
      archived.push(c);
      continue;
    }
    if (normalizeCaseTrack(c) === 'eviction') {
      eviction.push(c);
      continue;
    }
    if (isPostWinCase(c)) {
      postWin.push(c);
      continue;
    }
    biddingPrep.push(c);
  }

  const now = Date.now();
  const weekEnd = now + 7 * MS_DAY;

  const thisWeek = biddingPrep
    .filter((c) => {
      const t = parseAuctionTime(c.auctionDate);
      return Number.isFinite(t) && t >= now && t <= weekEnd;
    })
    .sort((a, b) => parseAuctionTime(a.auctionDate) - parseAuctionTime(b.auctionDate));

  const thisWeekIds = new Set(thisWeek.map((c) => c.id));
  const reviewing = biddingPrep
    .filter((c) => !thisWeekIds.has(c.id))
    .sort((a, b) => parseAuctionTime(a.auctionDate) - parseAuctionTime(b.auctionDate));

  postWin.sort((a, b) => parseAuctionTime(b.auctionDate) - parseAuctionTime(a.auctionDate));

  eviction.sort((a, b) => {
    if (a.stage === 'E' && b.stage !== 'E') return -1;
    if (b.stage === 'E' && a.stage !== 'E') return 1;
    return a.name.localeCompare(b.name, 'ko');
  });

  archived.sort((a, b) => parseAuctionTime(b.auctionDate) - parseAuctionTime(a.auctionDate));

  return { thisWeek, reviewing, postWin, eviction, archived };
}

export function countActiveCases(cases: CaseFile[]): {
  bidding: number;
  eviction: number;
} {
  let bidding = 0;
  let eviction = 0;
  for (const c of cases) {
    if (isArchivedCase(c)) continue;
    if (normalizeCaseTrack(c) === 'eviction') {
      eviction += 1;
    } else {
      bidding += 1;
    }
  }
  return { bidding, eviction };
}

export function contextSummary(c: CaseFile): string {
  const next = getNextAction(c);
  const parts: string[] = [next.label];
  if (c.evictionCoach?.analyzedAt) {
    parts.push('AI 분석 있음');
  }
  if (c.rightsAnalysis?.analyzedAt) {
    parts.push('권리분석 완료');
  }
  return parts.join(' · ');
}
