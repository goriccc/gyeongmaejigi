import { describe, expect, it } from 'vitest';
import { classifyTradeLiquidity } from '@/lib/field/tradeLiquidity';

function months(
  start: string,
  count: number,
  perMonth: number,
): { yearMonth: string }[] {
  const [y0, m0] = start.split('-').map(Number);
  const out: { yearMonth: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const idx = y0 * 12 + (m0 - 1) + i;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    for (let k = 0; k < perMonth; k++) out.push({ yearMonth: ym });
  }
  return out;
}

describe('classifyTradeLiquidity', () => {
  it('아파트: 매달 다건이면 매우 활발', () => {
    const r = classifyTradeLiquidity(months('2025-01', 6, 4), 'apt');
    expect(r?.tier).toBe('hot');
  });

  it('아파트: 매달 1~2건이면 준수', () => {
    const r = classifyTradeLiquidity(months('2025-01', 12, 1), 'apt');
    expect(r?.tier).toBe('steady');
  });

  it('아파트: 빈 달이 반복되면 뜨문뜨문', () => {
    const trades = [
      { yearMonth: '2026-08' },
      { yearMonth: '2026-08' },
      { yearMonth: '2026-04' },
      { yearMonth: '2026-01' },
      { yearMonth: '2025-08' },
    ];
    expect(classifyTradeLiquidity(trades, 'apt')?.tier).toBe('sparse');
  });

  it('단지형 기타: 월 1건이어도 대부분 달이면 활발', () => {
    const r = classifyTradeLiquidity(months('2025-09', 10, 1), 'complexOther');
    expect(r?.tier).toBe('hot');
  });

  it('단지형 기타: 두어 달에 한 번이면 준수', () => {
    const trades = [
      { yearMonth: '2026-08' },
      { yearMonth: '2026-06' },
      { yearMonth: '2026-04' },
      { yearMonth: '2026-02' },
      { yearMonth: '2025-12' },
      { yearMonth: '2025-10' },
    ];
    expect(classifyTradeLiquidity(trades, 'complexOther')?.tier).toBe('steady');
  });

  it('표본 부족이면 null', () => {
    expect(
      classifyTradeLiquidity(
        [{ yearMonth: '2026-08' }, { yearMonth: '2026-07' }],
        'apt',
      ),
    ).toBeNull();
  });
});
