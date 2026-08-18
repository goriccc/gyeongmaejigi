export type YearMonth = string; // YYYY-MM

export type LiquidityKind = 'apt' | 'complexOther';

export type LiquidityTier = 'hot' | 'steady' | 'sparse';

export type TradePoint = {
  yearMonth: YearMonth;
};

export type LiquidityResult = {
  tier: LiquidityTier;
  label: string;
  sample: number;
  spanMonths: number;
  monthsWithTrade: number;
  coverage: number;
  avgPerActiveMonth: number;
  maxGap: number;
};

const APT_SAMPLE = 20;
const OTHER_SAMPLE = 12;
const MIN_SAMPLE = 4;

export function liquiditySampleSize(kind: LiquidityKind): number {
  return kind === 'apt' ? APT_SAMPLE : OTHER_SAMPLE;
}

export function monthIndex(ym: YearMonth): number {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
}

export function indexToMonth(idx: number): YearMonth {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function maxEmptyGap(sortedUnique: YearMonth[]): number {
  if (sortedUnique.length <= 1) return 0;
  let max = 0;
  for (let i = 1; i < sortedUnique.length; i++) {
    const gap = monthIndex(sortedUnique[i]!) - monthIndex(sortedUnique[i - 1]!) - 1;
    if (gap > max) max = gap;
  }
  return max;
}

export function classifyTradeLiquidity(
  tradesNewestFirst: TradePoint[],
  kind: LiquidityKind,
): LiquidityResult | null {
  const cap = liquiditySampleSize(kind);
  const sample = tradesNewestFirst.slice(0, cap);
  if (sample.length < MIN_SAMPLE) return null;

  const unique = [...new Set(sample.map((t) => t.yearMonth))].sort();
  const start = monthIndex(unique[0]!);
  const end = monthIndex(unique[unique.length - 1]!);
  const spanMonths = end - start + 1;
  const monthsWithTrade = unique.length;
  const coverage = spanMonths > 0 ? monthsWithTrade / spanMonths : 0;
  const avgPerActiveMonth = monthsWithTrade > 0 ? sample.length / monthsWithTrade : 0;
  const maxGap = maxEmptyGap(unique);

  const tier =
    kind === 'apt'
      ? classifyApt(coverage, avgPerActiveMonth, maxGap)
      : classifyOther(coverage, maxGap);

  return {
    tier,
    label: liquidityLabel(tier, kind),
    sample: sample.length,
    spanMonths,
    monthsWithTrade,
    coverage,
    avgPerActiveMonth,
    maxGap,
  };
}

function classifyApt(
  coverage: number,
  avgPerActiveMonth: number,
  maxGap: number,
): LiquidityTier {
  const monthly = coverage >= 0.75 && maxGap <= 1;
  if (monthly && avgPerActiveMonth >= 3) return 'hot';
  if (monthly) return 'steady';
  return 'sparse';
}

function classifyOther(coverage: number, maxGap: number): LiquidityTier {
  if (coverage >= 0.55 && maxGap <= 1) return 'hot';
  if (maxGap <= 2 || coverage >= 0.35) return 'steady';
  return 'sparse';
}

export function liquidityLabel(
  tier: LiquidityTier,
  kind: LiquidityKind,
): string {
  const prefix = kind === 'apt' ? '아파트' : '단지형';
  if (tier === 'hot') return `${prefix} · 매도·매수 매우 활발`;
  if (tier === 'steady') return `${prefix} · 준수한 편`;
  return `${prefix} · 입지적으로 매력적이지 않음`;
}
