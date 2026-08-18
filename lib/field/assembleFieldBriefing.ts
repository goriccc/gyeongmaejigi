import { geocodeAddressDetail } from '@/lib/auction/geocode';
import {
  fetchBuildingRecap,
  fetchBuildingTitles,
  dongHintFromAddress,
  pickRecapUseApr,
  pickTitleUseApr,
} from '@/lib/field/buildingLedger';
import {
  inferPropTypeFromLedger,
  isComplexLike,
  liquidityKindFor,
  type PropType,
} from '@/lib/field/complexLike';
import {
  fetchComplexScale,
  resolveCanonicalComplexName,
  scaleFromSeedTitles,
} from '@/lib/field/complexScale';
import { fetchMatchingTrades } from '@/lib/field/rtmsClient';
import { liquiditySampleSize } from '@/lib/field/tradeLiquidity';
import { BRIEFING_SCHEMA_VERSION } from '@/lib/field/briefingCache';
import type {
  FieldBriefingInput,
  FieldBriefingSnapshot,
  FieldBriefingTrade,
} from '@/types/case';

function toTrade(t: {
  yearMonth: string;
  day: number;
  dong: string | null;
  floor: string | null;
  areaM2: number | null;
  amountMan: number;
}): FieldBriefingTrade {
  return {
    yearMonth: t.yearMonth,
    day: t.day,
    dong: t.dong,
    floor: t.floor,
    areaM2: t.areaM2,
    amountMan: t.amountMan,
  };
}

export async function assembleFieldBriefing(
  c: FieldBriefingInput,
): Promise<FieldBriefingSnapshot> {
  let propType: PropType = c.entryMatchInputs?.propType ?? '아파트';
  const address = c.address?.trim() ?? '';

  const base: FieldBriefingSnapshot = {
    fetchedAt: new Date().toISOString(),
    schemaVersion: BRIEFING_SCHEMA_VERSION,
    propType,
    warnings: [],
  };

  if (!address) {
    base.warnings?.push('소재지가 없어 실거래·연식을 조회하지 못했습니다.');
    return base;
  }

  const geo = await geocodeAddressDetail(address);
  if (!geo?.bCode || geo.bCode.length < 10) {
    base.warnings?.push(
      '주소를 법정동 코드로 변환하지 못했습니다. KAKAO_REST_API_KEY를 확인하세요.',
    );
    return base;
  }

  const lawdCd = geo.bCode.slice(0, 5);
  const sigunguCd = geo.bCode.slice(0, 5);
  const bjdongCd = geo.bCode.slice(5, 10);

  const { titles, error: titleErr } = await fetchBuildingTitles({
    sigunguCd,
    bjdongCd,
    bun: geo.bun,
    ji: geo.ji,
    mountain: geo.mountain,
  });
  if (titleErr === 'missing-key') {
    base.warnings?.push(
      'DATA_GO_KR_SERVICE_KEY가 없어 연식·실거래를 조회하지 못했습니다.',
    );
    return base;
  }

  propType = inferPropTypeFromLedger(titles, propType);
  base.propType = propType;

  const dongHint = dongHintFromAddress(`${c.name ?? ''} ${address}`);
  const picked = pickTitleUseApr(titles, dongHint);
  if (picked?.useAprYear) base.buildYear = picked.useAprYear;
  if (picked?.useAprDay) base.useAprDay = picked.useAprDay;

  const seedScale = scaleFromSeedTitles(titles);
  if (seedScale) {
    base.householdCount = seedScale.householdCount;
    base.buildingCount = seedScale.buildingCount;
  }

  const kindHint = liquidityKindFor(
    propType,
    isComplexLike({
      propType,
      name: c.name ?? address,
      uniqueDongs: 0,
      titleBuildings: titles.length,
    }),
  );

  const target = kindHint ? liquiditySampleSize(kindHint) : 12;
  const ledgerNames = titles
    .map((t) => t.buildingName)
    .filter((name): name is string => Boolean(name));
  const { trades, error: rtmsErr, relaxed } = await fetchMatchingTrades({
    lawdCd,
    propType,
    caseName: c.name ?? address,
    address,
    buildingName: geo.buildingName,
    ledgerNames,
    exclusiveAreaM2: c.exclusiveAreaM2,
    bun: geo.bun,
    target,
  });

  if (rtmsErr === 'missing-key') {
    base.warnings?.push('공공데이터 인증키가 없어 실거래를 조회하지 못했습니다.');
  } else if (trades.length === 0) {
    base.warnings?.push('같은 단지·유사 면적 실거래를 찾지 못했습니다.');
  } else {
    base.trades = trades.map(toTrade);
    if (relaxed) {
      base.warnings?.push(
        '전용면적 정보가 없거나 단지명 매칭이 넓어, 같은 단지 실거래 전체를 표시했습니다.',
      );
    }
    if (!base.buildYear) {
      const by = trades.find((t) => t.buildYear)?.buildYear;
      if (by) base.buildYear = by;
    }
  }

  const canonicalName = resolveCanonicalComplexName({
    tradeNames: trades.map((t) => t.name).filter(Boolean),
    ledgerNames,
    buildingName: geo.buildingName,
    address,
  });
  if (canonicalName && titleErr !== 'missing-key') {
    base.complexName = canonicalName;
    const scale = await fetchComplexScale({
      propType,
      canonicalName,
      address,
      seedPlat: {
        sigunguCd,
        bjdongCd,
        bun: (geo.bun ?? '').replace(/\D/g, '').padStart(4, '0'),
        ji: (geo.ji ?? '').replace(/\D/g, '').padStart(4, '0') || '0000',
        mountain: Boolean(geo.mountain),
      },
      seedTitles: titles,
    });
    if (scale) {
      if (scale.householdCount > 0) base.householdCount = scale.householdCount;
      if (scale.buildingCount > 0) base.buildingCount = scale.buildingCount;
      if (
        scale.useAprDay &&
        (!base.useAprDay || base.useAprDay.length < 8)
      ) {
        base.useAprDay = scale.useAprDay;
        const y = Number(scale.useAprDay.slice(0, 4));
        if (y > 1900) base.buildYear = y;
      }
    } else if (!seedScale) {
      base.warnings?.push('건축대장에서 세대·동 규모를 찾지 못했습니다.');
    }
  } else if (
    titleErr !== 'missing-key' &&
    (!base.useAprDay || base.useAprDay.length < 8)
  ) {
    const recaps = await fetchBuildingRecap({
      sigunguCd,
      bjdongCd,
      bun: (geo.bun ?? '').replace(/\D/g, '').padStart(4, '0'),
      ji: (geo.ji ?? '').replace(/\D/g, '').padStart(4, '0') || '0000',
      mountain: Boolean(geo.mountain),
    });
    const recapDay = pickRecapUseApr(recaps);
    if (recapDay) {
      base.useAprDay = recapDay;
      const y = Number(recapDay.slice(0, 4));
      if (y > 1900) base.buildYear = y;
    }
  }

  return base;
}
