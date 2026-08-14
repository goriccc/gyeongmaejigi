import { describe, expect, it } from 'vitest';
import {
  buildTakyungCaseNumber,
  formatCourtLabel,
  formatDisplayCaseNumber,
  formatYmd,
  normalizeCaseNumber,
  parseAmount,
} from './caseNumberFormat';
import { mapCourtAuctionCase } from './mapCaseLookup';

describe('formatCourtLabel', () => {
  it('does not duplicate identical branch name', () => {
    expect(formatCourtLabel('군산지원', '군산지원')).toBe('군산지원');
    expect(formatCourtLabel('대구지방법원', '대구지방법원')).toBe('대구지방법원');
  });
});

describe('formatDisplayCaseNumber', () => {
  it('decodes internal csNo to typed format', () => {
    expect(formatDisplayCaseNumber('20240130115901', null, '2024타경115901')).toBe(
      '2024타경115901',
    );
  });

  it('prefers userCsNo', () => {
    expect(
      formatDisplayCaseNumber('20240130115901', '2024타경115901', undefined),
    ).toBe('2024타경115901');
  });
});

describe('normalizeCaseNumber', () => {
  it('adds 타경 for year-number input', () => {
    expect(normalizeCaseNumber('2024-115901')).toBe('2024타경115901');
  });
});

describe('parseAmount', () => {
  it('parses comma amounts and html', () => {
    expect(parseAmount('667,000,000원')).toBe(667_000_000);
    expect(parseAmount('<span>580,000,000</span>')).toBe(580_000_000);
  });
});

describe('formatYmd', () => {
  it('normalizes dotted dates for date inputs', () => {
    expect(formatYmd('2026.08.21')).toBe('2026-08-21');
  });
});

describe('buildTakyungCaseNumber', () => {
  it('builds typed case number', () => {
    expect(buildTakyungCaseNumber('2024', '115901')).toBe('2024타경115901');
  });
});

describe('mapCourtAuctionCase', () => {
  it('falls back to item appraisal and sale date', () => {
    const mapped = mapCourtAuctionCase(
      {
        found: true,
        caseInfo: {
          caseNumber: '20240130115901',
          userCaseNumber: '2024타경115901',
        },
        items: [
          {
            address: '전북 군산시 ...',
            appraisedPrice: 580_000_000,
            saleDate: '2026-08-21',
          },
        ],
        schedule: [],
      },
      'B000240',
      '군산지원',
      '2024타경115901',
    );

    expect(mapped).toMatchObject({
      appraisalValue: 580_000_000,
      auctionDate: '2026-08-21',
    });
  });

  it('maps bid deposit from schedule', () => {
    const mapped = mapCourtAuctionCase(
      {
        found: true,
        caseInfo: { caseNumber: '2024타경115901' },
        items: [{ address: '전북 군산시 ...' }],
        schedule: [
          {
            saleDate: '2026-08-21',
            appraisedPrice: 580_000_000,
            minimumSalePrice: 464_000_000,
            depositRate: 20,
            failedBidCount: 2,
            auctionRound: 3,
          },
        ],
      },
      'B000240',
      '군산지원',
      '2024타경115901',
    );

    expect(mapped?.bidDepositRate).toBe(20);
    expect(mapped?.bidDepositAmount).toBe(92_800_000);
    expect(mapped?.auctionRound).toBe(3);
    expect(mapped?.minimumSalePrice).toBe(464_000_000);
  });

  it('maps address, next sale date, and appraisal', () => {
    const mapped = mapCourtAuctionCase(
      {
        found: true,
        caseInfo: {
          courtCode: 'B000210',
          courtName: '서울중앙지방법원',
          caseNumber: '20240130115901',
          userCaseNumber: '2024타경100001',
          caseName: '부동산강제경매',
        },
        items: [{ address: '서울특별시 강남구 역삼동 123-45' }],
        schedule: [
          {
            saleDate: '2024-01-10',
            appraisedPrice: 500_000_000,
            resultCode: '0003311',
          },
          {
            saleDate: '2026-09-15',
            appraisedPrice: 667_000_000,
            resultCode: '',
          },
        ],
      },
      'B000210',
      '서울중앙지방법원',
      '2024타경100001',
    );

    expect(mapped).toMatchObject({
      name: '서울특별시 강남구 역삼동 123-45',
      address: '서울특별시 강남구 역삼동 123-45',
      caseNumber: '2024타경100001',
      appraisalValue: 667_000_000,
      auctionDate: '2026-09-15',
    });
  });

  it('maps exclusive area from payload', () => {
    const mapped = mapCourtAuctionCase(
      {
        found: true,
        caseInfo: { caseNumber: '2024타경115901' },
        items: [{ address: '전북 군산시 ...' }],
        schedule: [],
        exclusiveAreaM2: 49.67,
      },
      'B000240',
      '군산지원',
      '2024타경115901',
    );

    expect(mapped?.exclusiveAreaM2).toBe(49.67);
  });

  it('maps appraisal, min price, deposit for selected property number', () => {
    const mapped = mapCourtAuctionCase(
      {
        found: true,
        caseInfo: { caseNumber: '2024타경9999' },
        items: [
          {
            propertyNumber: 1,
            address: '물건 1',
            appraisedPrice: 500_000_000,
            minimumSalePrice: 400_000_000,
            depositRate: 10,
          },
          {
            propertyNumber: 2,
            address: '물건 2',
            appraisedPrice: 800_000_000,
            minimumSalePrice: 640_000_000,
            depositRate: 20,
          },
        ],
        schedule: [
          {
            propertyNumber: 1,
            saleDate: '2026-03-01',
            appraisedPrice: 500_000_000,
            minimumSalePrice: 400_000_000,
            depositRate: 10,
          },
          {
            propertyNumber: 2,
            saleDate: '2026-04-01',
            appraisedPrice: 800_000_000,
            minimumSalePrice: 640_000_000,
            depositRate: 20,
          },
        ],
      },
      'B000210',
      '서울중앙지방법원',
      '2024타경9999',
      2,
    );

    expect(mapped).toMatchObject({
      propertyNumber: 2,
      address: '물건 2',
      appraisalValue: 800_000_000,
      minimumSalePrice: 640_000_000,
      auctionDate: '2026-04-01',
      bidDepositRate: 20,
      bidDepositAmount: 128_000_000,
    });
  });
});
