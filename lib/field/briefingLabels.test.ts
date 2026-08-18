import { describe, expect, it } from 'vitest';
import {
  formatBuildYearLabel,
  formatScaleLabel,
} from '@/lib/field/briefingLabels';

describe('briefingLabels', () => {
  it('formats scale', () => {
    expect(formatScaleLabel(363, 7)).toBe('363세대 · 7동');
    expect(formatScaleLabel(102, undefined)).toBe('102세대');
    expect(formatScaleLabel()).toBeNull();
  });

  it('formats build year with age', () => {
    expect(formatBuildYearLabel(new Date().getFullYear())).toBe(
      `${new Date().getFullYear()}년`,
    );
  });

  it('formats full use approval date', () => {
    expect(
      formatBuildYearLabel(1987, '19871029', new Date('2026-08-19')),
    ).toBe('1987년 10월 29일 (38년차)');
    expect(
      formatBuildYearLabel(1987, '19871029', new Date('2026-10-29')),
    ).toBe('1987년 10월 29일 (39년차)');
  });
});
