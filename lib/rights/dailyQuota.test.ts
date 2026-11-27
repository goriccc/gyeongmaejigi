import { describe, expect, it } from 'vitest';
import {
  buildRightsDailyCookie,
  isRightsQuotaUsedToday,
  kstDateKey,
  parseCookieHeader,
  RIGHTS_DAILY_COOKIE,
  secondsUntilNextKstMidnight,
} from '@/lib/rights/dailyQuota';

describe('rights dailyQuota', () => {
  it('kstDateKey is YYYY-MM-DD', () => {
    expect(kstDateKey(new Date('2026-11-27T01:00:00Z'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('parseCookieHeader reads named cookie', () => {
    const h = `${RIGHTS_DAILY_COOKIE}=2026-11-27; Path=/; Other=1`;
    expect(parseCookieHeader(h, RIGHTS_DAILY_COOKIE)).toBe('2026-11-27');
  });

  it('isRightsQuotaUsedToday matches today key', () => {
    const today = kstDateKey();
    expect(
      isRightsQuotaUsedToday(`${RIGHTS_DAILY_COOKIE}=${today}`),
    ).toBe(true);
    expect(
      isRightsQuotaUsedToday(`${RIGHTS_DAILY_COOKIE}=2000-01-01`),
    ).toBe(false);
    expect(isRightsQuotaUsedToday(null)).toBe(false);
  });

  it('secondsUntilNextKstMidnight is within a day', () => {
    const s = secondsUntilNextKstMidnight();
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(24 * 3600);
  });

  it('buildRightsDailyCookie includes Max-Age and name', () => {
    const c = buildRightsDailyCookie('2026-11-27');
    expect(c).toContain(`${RIGHTS_DAILY_COOKIE}=2026-11-27`);
    expect(c).toMatch(/Max-Age=\d+/);
  });
});
