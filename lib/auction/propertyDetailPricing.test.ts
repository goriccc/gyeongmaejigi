import { describe, expect, it } from 'vitest';
import { parsePropertyDetailPricing } from '@/lib/auction/propertyDetailPricing';

describe('parsePropertyDetailPricing', () => {
  it('2025타경104034 물건내역 — tsLwsDspslPrc·prchDposRate', () => {
    const parsed = parsePropertyDetailPricing({
      dma_result: {
        dspslGdsDxdyInfo: {
          aeeEvlAmt: 1_580_000_000,
          flbdNcnt: 1,
          dspslDxdyYmd: '20260819',
          prchDposRate: 10,
          fstPbancLwsDspslPrc: 1_264_000_000,
        },
        gdsDspslDxdyLst: [
          {
            dxdyYmd: '20260715',
            auctnDxdyKndCd: '01',
            auctnDxdyRsltCd: '002',
            tsLwsDspslPrc: 1_580_000_000,
          },
          {
            dxdyYmd: '20260819',
            auctnDxdyKndCd: '01',
            auctnDxdyGdsStatCd: '00',
            tsLwsDspslPrc: 1_264_000_000,
          },
        ],
        gdsDspslObjctLst: [],
        bldSdtrDtlLstAll: [],
      },
    });

    expect(parsed).toMatchObject({
      appraisedPrice: 1_580_000_000,
      minimumSalePrice: 1_264_000_000,
      depositRate: 10,
      failedBidCount: 1,
      auctionRound: 2,
      saleDate: '2026-08-19',
    });
  });
});
