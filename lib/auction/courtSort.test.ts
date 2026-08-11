import { describe, expect, it } from 'vitest';
import { sortCourtList } from './courtSort';

describe('sortCourtList', () => {
  it('orders seoul, incheon, gyeonggi, busan, then alpha, jeju last', () => {
    const items = sortCourtList([
      { code: 'J', label: '제주지방법원' },
      { code: 'D', label: '대구지방법원' },
      { code: 'B', label: '부산지방법원' },
      { code: 'S', label: '서울중앙지방법원' },
      { code: 'G', label: '광주지방법원' },
      { code: 'I', label: '인천지방법원' },
      { code: 'U', label: '수원지방법원' },
      { code: 'C', label: '창원지방법원' },
    ]);

    expect(items.map((i) => i.label)).toEqual([
      '서울중앙지방법원',
      '인천지방법원',
      '수원지방법원',
      '부산지방법원',
      '광주지방법원',
      '대구지방법원',
      '창원지방법원',
      '제주지방법원',
    ]);
  });
});
