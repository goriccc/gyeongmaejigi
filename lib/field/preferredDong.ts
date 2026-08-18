export type NamedTrade = {
  dong?: string | null;
};

export type PreferredDong = {
  dong: string;
  count: number;
  sample: number;
  reason: string;
};

const MIN_DONG_HITS = 3;
const MIN_DISTINCT = 2;

export function inferPreferredDong(trades: NamedTrade[]): PreferredDong | null {
  const counted = new Map<string, number>();
  let sample = 0;
  for (const t of trades) {
    const dong = (t.dong ?? '').trim();
    if (!dong || dong === '-' || dong === '—') continue;
    sample += 1;
    counted.set(dong, (counted.get(dong) ?? 0) + 1);
  }
  if (counted.size < MIN_DISTINCT) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [dong, n] of counted) {
    if (n > bestCount) {
      best = dong;
      bestCount = n;
    }
  }
  if (!best || bestCount < MIN_DONG_HITS) return null;

  return {
    dong: best,
    count: bestCount,
    sample,
    reason: `동이 공개된 ${sample}건 중 ${bestCount}건이 ${best}`,
  };
}
