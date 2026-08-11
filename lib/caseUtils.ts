import type { CaseFile, CaseTrack } from '@/types/case';
import { resolveBidDeposit } from '@/lib/auction/bidDeposit';
import { formatAuctionRoundLabel } from '@/lib/auction/auctionRound';

export type CaseNextAction = {
  href: string;
  label: string;
};

export type CaseGroups = {
  thisWeek: CaseFile[];
  reviewing: CaseFile[];
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

export function isArchivedCase(c: CaseFile): boolean {
  if (c.stage === 'done') return true;
  if (normalizeCaseTrack(c) === 'bidding') {
    return c.bidOutcome === 'lost' || c.bidOutcome === 'skipped';
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

export function caseDisplayName(c: CaseFile): string {
  if (c.clientLabel?.trim()) {
    return `${c.name.trim()} (${c.clientLabel.trim()})`;
  }
  return c.name;
}

export function caseMetaLine(c: CaseFile): string {
  const parts: string[] = [];
  if (c.address?.trim()) parts.push(c.address.trim());
  if (c.caseNumber?.trim()) parts.push(c.caseNumber.trim());
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
  if (deposit.amount > 0) {
    parts.push(`보증금 ${formatDepositAmount(deposit.amount)} (${deposit.rate}%)`);
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

  if (track === 'eviction' || c.stage === 'E') {
    return { href: '/e', label: '명도 코칭' };
  }

  if (c.stage === 'done') {
    return { href: '/e', label: '명도 기록 보기' };
  }

  if (!c.entryMatchResult) {
    return { href: '/', label: '투자 상담' };
  }
  if (!c.rightsAnalysis?.analyzedAt && c.riskFlags.length === 0) {
    return { href: '/b', label: '권리분석' };
  }
  if (c.stage === 'B' || (c.riskFlags.length > 0 && c.stage === 'C')) {
    const unchecked = c.checklist.filter((i) => !i.checked).length;
    if (c.stage === 'C' && unchecked > 0) {
      return { href: '/c', label: `임장 체크 ${c.checklist.length - unchecked}/${c.checklist.length}` };
    }
    if (c.stage === 'B') {
      return { href: '/c', label: '임장 준비' };
    }
  }
  if (c.stage === 'C' && !c.bidCalcInputs) {
    return { href: '/c', label: '임장 준비' };
  }
  if (c.stage === 'D' || c.bidCalcInputs) {
    if (c.bidOutcome === 'pending' || !c.bidOutcome) {
      return { href: '/d', label: '입찰가 확인' };
    }
    if (c.bidOutcome === 'won' && (c.stage === 'D' || c.stage === 'F')) {
      return { href: '/f', label: '대출상품 비교' };
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
  const biddingActive: CaseFile[] = [];

  for (const c of cases) {
    if (isArchivedCase(c)) {
      archived.push(c);
      continue;
    }
    if (normalizeCaseTrack(c) === 'eviction' || c.stage === 'E') {
      eviction.push(c);
      continue;
    }
    biddingActive.push(c);
  }

  const now = Date.now();
  const weekEnd = now + 7 * MS_DAY;

  const thisWeek = biddingActive
    .filter((c) => {
      const t = parseAuctionTime(c.auctionDate);
      return Number.isFinite(t) && t >= now && t <= weekEnd;
    })
    .sort((a, b) => parseAuctionTime(a.auctionDate) - parseAuctionTime(b.auctionDate));

  const thisWeekIds = new Set(thisWeek.map((c) => c.id));
  const reviewing = biddingActive
    .filter((c) => !thisWeekIds.has(c.id))
    .sort((a, b) => parseAuctionTime(a.auctionDate) - parseAuctionTime(b.auctionDate));

  eviction.sort((a, b) => {
    if (a.stage === 'E' && b.stage !== 'E') return -1;
    if (b.stage === 'E' && a.stage !== 'E') return 1;
    return a.name.localeCompare(b.name, 'ko');
  });

  archived.sort((a, b) => parseAuctionTime(b.auctionDate) - parseAuctionTime(a.auctionDate));

  return { thisWeek, reviewing, eviction, archived };
}

export function countActiveCases(cases: CaseFile[]): {
  bidding: number;
  eviction: number;
} {
  let bidding = 0;
  let eviction = 0;
  for (const c of cases) {
    if (isArchivedCase(c)) continue;
    if (normalizeCaseTrack(c) === 'eviction' || c.stage === 'E') {
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
