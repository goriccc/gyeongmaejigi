import { NextResponse } from 'next/server';
import {
  calcHousingBondPurchaseAmount,
  estimateBondCustomerBurden,
  inferHousingBondRegion,
  type HousingBondRegion,
} from '@/lib/calc/housingBond';
import { resolveBondBasisDate } from '@/lib/calc/businessDay';
import {
  fetchCustomerBurden,
  formatYmd,
  resolveDiscountRatePct,
} from '@/lib/housingBond/wooriClient';

export const runtime = 'nodejs';

export type HousingBondApiResult = {
  officialPrice: number;
  region: HousingBondRegion;
  exempt: boolean;
  purchaseAmount: number;
  purchaseRatePerMille: number | null;
  discountRatePct: number;
  customerBurden: number;
  basisDate: string;
  source: 'woori' | 'estimated';
  note: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const officialPrice = parseInt(
      url.searchParams.get('officialPrice') ?? '',
      10,
    );
    if (!Number.isFinite(officialPrice) || officialPrice < 0) {
      return NextResponse.json(
        { error: '공시가(시가표준액)가 필요합니다.' },
        { status: 400 },
      );
    }

    const regionParam = url.searchParams.get('region');
    const address = url.searchParams.get('address') ?? undefined;
    const region: HousingBondRegion =
      regionParam === 'metro' || regionParam === 'other'
        ? regionParam
        : inferHousingBondRegion(address);

    const purchase = calcHousingBondPurchaseAmount(officialPrice, region);
    if (purchase.exempt) {
      return NextResponse.json({
        officialPrice,
        region,
        exempt: true,
        purchaseAmount: 0,
        purchaseRatePerMille: null,
        discountRatePct: 0,
        customerBurden: 0,
        basisDate: formatYmd(resolveBondBasisDate(new Date())),
        source: 'woori',
        note: '시가표준액 2천만원 미만 — 국민주택채권 매입 면제',
      } satisfies HousingBondApiResult);
    }

    const basisDate = resolveBondBasisDate(new Date());
    let discountRatePct: number;
    let basisDateYmd: string;
    let customerBurden: number;
    let source: HousingBondApiResult['source'] = 'woori';

    try {
      const rate = await resolveDiscountRatePct(basisDate);
      discountRatePct = rate.discountRatePct;
      basisDateYmd = rate.basisDate;

      try {
        const burden = await fetchCustomerBurden(
          purchase.purchaseAmount,
          basisDateYmd,
        );
        customerBurden = burden.customerBurden;
      } catch {
        customerBurden = estimateBondCustomerBurden(
          purchase.purchaseAmount,
          discountRatePct,
        );
        source = 'estimated';
      }
    } catch {
      discountRatePct = 12;
      basisDateYmd = formatYmd(basisDate);
      customerBurden = estimateBondCustomerBurden(
        purchase.purchaseAmount,
        discountRatePct,
      );
      source = 'estimated';
    }

    const note =
      source === 'woori'
        ? `공시가 × ${purchase.ratePerMille}‰ · ${basisDateYmd} 할인율 ${discountRatePct.toFixed(5)}% (주택도시기금/우리은행)`
        : `공시가 × ${purchase.ratePerMille}‰ · 할인율 조회 실패 — ${discountRatePct}% 추정치 적용`;

    return NextResponse.json({
      officialPrice,
      region,
      exempt: false,
      purchaseAmount: purchase.purchaseAmount,
      purchaseRatePerMille: purchase.ratePerMille,
      discountRatePct,
      customerBurden,
      basisDate: basisDateYmd,
      source,
      note,
    } satisfies HousingBondApiResult);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : '국민주택채권 계산 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
