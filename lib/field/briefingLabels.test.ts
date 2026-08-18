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
});
