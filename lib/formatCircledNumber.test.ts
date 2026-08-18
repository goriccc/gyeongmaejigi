import { describe, expect, it } from 'vitest';
import { formatCircledNumber } from '@/lib/format';

describe('formatCircledNumber', () => {
  it('1–20은 원형 숫자', () => {
    expect(formatCircledNumber(1)).toBe('①');
    expect(formatCircledNumber(2)).toBe('②');
    expect(formatCircledNumber(20)).toBe('⑳');
  });

  it('20 초과는 괄호 숫자', () => {
    expect(formatCircledNumber(21)).toBe('(21)');
  });

  it('1 미만은 빈 문자열', () => {
    expect(formatCircledNumber(0)).toBe('');
  });
});
