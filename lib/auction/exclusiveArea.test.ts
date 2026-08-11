import { describe, expect, it } from 'vitest';
import {
  parseExclusiveAreaFromText,
  parseExclusiveAreaM2,
} from './exclusiveArea';

describe('parseExclusiveAreaFromText', () => {
  it('parses area suffix from building description', () => {
    expect(parseExclusiveAreaFromText('철근콘크리트구조 49.67㎡')).toBe(49.67);
  });

  it('returns null when no area suffix', () => {
    expect(parseExclusiveAreaFromText('철근콘크리트구조')).toBeNull();
  });
});

describe('parseExclusiveAreaM2', () => {
  it('prefers 전유 building detail over search integers', () => {
    expect(
      parseExclusiveAreaM2([
        { minArea: '49', maxArea: '49' },
        {
          rletDvsDts: '전유',
          bldSdtrDtlDts: '철근콘크리트구조 49.67㎡',
        },
      ]),
    ).toBe(49.67);
  });

  it('falls back to search min/max area', () => {
    expect(parseExclusiveAreaM2([{ minArea: '84', maxArea: '84.99' }])).toBe(
      84.99,
    );
  });

  it('parses pjbBuldList from property detail', () => {
    expect(
      parseExclusiveAreaM2([{ pjbBuldList: '철근콘크리트구조 59.12㎡' }]),
    ).toBe(59.12);
  });
});
