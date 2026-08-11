import { stripHtml } from '@/lib/auction/caseNumberFormat';

export function parseFailedBidCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = stripHtml(value).replace(/[^\d]/g, '');
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/** 유찰 횟수 + 1 = 금번 매각 회차 */
export function toAuctionRound(
  failedBidCount: number | null | undefined,
): number | undefined {
  if (failedBidCount === null || failedBidCount === undefined) return undefined;
  return failedBidCount + 1;
}

export function parseAuctionRound(row: Record<string, unknown>): number | undefined {
  const direct = parseFailedBidCount(
    row.dspslDxdySeq ?? row.maeGiilSeq ?? row.dxdyOrd ?? row.dxdySeq,
  );
  if (direct !== null && direct > 0) return direct;

  return toAuctionRound(
    parseFailedBidCount(row.flbdNcnt ?? row.yuchalCnt ?? row.usflbdNcnt),
  );
}

export function formatAuctionRoundLabel(round: number | undefined): string {
  if (!round || round <= 0) return '—';
  return `${round}회차`;
}
