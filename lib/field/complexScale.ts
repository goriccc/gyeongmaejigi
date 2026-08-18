import {
  addressDeclaresComplex,
  sameComplexBuildingName,
  resolveOfficialComplexName,
} from '@/lib/field/complexName';
import type { PropType } from '@/lib/field/complexLike';
import {
  fetchAttachedPlats,
  fetchBuildingRecap,
  fetchBuildingTitles,
  fetchNamedComplexInBjdong,
  fetchNamedRecapsInBjdong,
  fetchNamedRecapsInSigungu,
  countExclusiveResidentialUnits,
  countExposUnits,
  platKeyStr,
  titleHouseholdCount,
  type BuildingRecap,
  type BuildingTitle,
  type PlatKey,
} from '@/lib/field/buildingLedger';

export type ComplexScale = {
  complexName: string;
  householdCount: number;
  buildingCount: number;
  parcelCount: number;
};

/** 한 동만 잡히면 단지 전체 필지로 확장 */
export function shouldExpandComplexPlats(scale: {
  householdCount: number;
  buildingCount: number;
}): boolean {
  if (scale.householdCount <= 0) return true;
  return scale.buildingCount <= 1;
}

export function pickLargerComplexScale<
  T extends { householdCount: number; buildingCount: number },
>(current: T, candidate: T): T {
  if (candidate.buildingCount > current.buildingCount) return candidate;
  if (candidate.buildingCount <= 1 && current.buildingCount <= 1) {
    if (current.householdCount <= 0 && candidate.householdCount > 0) {
      return candidate;
    }
    return current;
  }
  if (
    candidate.buildingCount === current.buildingCount &&
    candidate.householdCount > current.householdCount
  ) {
    return candidate;
  }
  return current;
}

/** 총괄이 단지 전체인데 표제부는 한 동만 있으면 총괄을 쓴다 */
export function preferComplexWideScale(
  recap: { householdCount: number; buildingCount: number },
  titles: { householdCount: number; buildingCount: number },
): { householdCount: number; buildingCount: number } {
  if (
    recap.buildingCount > 1 &&
    titles.buildingCount <= 1 &&
    recap.householdCount >= titles.householdCount
  ) {
    return recap;
  }
  if (titles.buildingCount > 1 && titles.householdCount > 0) {
    return {
      householdCount: titles.householdCount,
      buildingCount: Math.max(recap.buildingCount, titles.buildingCount),
    };
  }
  return {
    householdCount: reconcileHouseholdCount(
      recap.householdCount,
      titles.householdCount,
    ),
    buildingCount: Math.max(recap.buildingCount, titles.buildingCount),
  };
}

function dedupeRecapKey(recap: BuildingRecap): string {
  if (recap.pk) return `pk:${recap.pk}`;
  return `sig:${recap.hhldCnt}-${recap.mainBldCnt}-${recap.bldNm ?? ''}`;
}

function sumDedupedRecaps(recaps: BuildingRecap[]): {
  householdCount: number;
  buildingCount: number;
} {
  const seen = new Set<string>();
  let householdCount = 0;
  let buildingCount = 0;

  for (const recap of recaps) {
    const key = dedupeRecapKey(recap);
    if (seen.has(key)) continue;
    seen.add(key);
    householdCount += recap.hhldCnt;
    buildingCount += recap.mainBldCnt;
  }

  return { householdCount, buildingCount };
}

/** 대단지 총괄 한 건이 있으면 그 값을 쓰고, 없으면 동별 총괄을 합산 */
export function aggregateNamedRecaps(recaps: BuildingRecap[]): {
  householdCount: number;
  buildingCount: number;
} {
  if (recaps.length === 0) {
    return { householdCount: 0, buildingCount: 0 };
  }
  const widest = recaps.reduce((best, recap) => {
    if (recap.mainBldCnt > best.mainBldCnt) return recap;
    if (recap.mainBldCnt === best.mainBldCnt && recap.hhldCnt > best.hhldCnt) {
      return recap;
    }
    return best;
  });
  if (widest.mainBldCnt > 1) {
    return {
      householdCount: widest.hhldCnt,
      buildingCount: widest.mainBldCnt,
    };
  }
  return sumDedupedRecaps(recaps);
}

/** 필지별 총괄표제부 — 단지명 일치분만 합산 */
export function aggregatePlatRecaps(
  recaps: BuildingRecap[],
  canonicalName: string,
  options?: { allowUnnamed?: boolean },
): { householdCount: number; buildingCount: number } {
  const named = recaps.filter(
    (r) => r.bldNm && sameComplexBuildingName(r.bldNm, canonicalName),
  );
  if (named.length) return sumDedupedRecaps(named);

  if (
    options?.allowUnnamed &&
    recaps.length === 1 &&
    !recaps[0].bldNm &&
    recaps[0].hhldCnt > 0
  ) {
    return {
      householdCount: recaps[0].hhldCnt,
      buildingCount: recaps[0].mainBldCnt,
    };
  }

  return { householdCount: 0, buildingCount: 0 };
}

export function aggregateRecapTotals(
  recaps: BuildingRecap[],
  canonicalName: string,
): { householdCount: number; buildingCount: number } {
  return aggregatePlatRecaps(recaps, canonicalName, { allowUnnamed: true });
}

export function aggregateRecapTotalsByPlat(
  platRecaps: Array<{ platKey: string; recaps: BuildingRecap[] }>,
  seedPlatKey: string,
  canonicalName: string,
): { householdCount: number; buildingCount: number } {
  let householdCount = 0;
  let buildingCount = 0;

  for (const { platKey, recaps } of platRecaps) {
    const plat = aggregatePlatRecaps(recaps, canonicalName, {
      allowUnnamed: platKey === seedPlatKey,
    });
    householdCount += plat.householdCount;
    buildingCount += plat.buildingCount;
  }

  return { householdCount, buildingCount };
}

/** 표제부(세대)·총괄표제부 불일치 시 표제부 우선 */
export function reconcileHouseholdCount(
  recapCount: number,
  titleCount: number,
): number {
  if (titleCount > 0) return titleCount;
  return recapCount > 0 ? recapCount : 0;
}

export function collectPlatKeys(
  seed: PlatKey,
  attached: PlatKey[],
  nameMatched: PlatKey[],
): PlatKey[] {
  const seen = new Set<string>();
  const out: PlatKey[] = [];
  const add = (p: PlatKey) => {
    const key = platKeyStr(p);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };
  add(seed);
  for (const p of attached) add(p);
  for (const p of nameMatched) add(p);
  return out;
}

export function resolveCanonicalComplexName(input: {
  tradeNames: string[];
  ledgerNames: string[];
  buildingName?: string;
  address?: string;
}): string | null {
  return resolveOfficialComplexName(input);
}

async function fetchRecapsByPlat(
  plats: PlatKey[],
): Promise<Array<{ platKey: string; recaps: BuildingRecap[] }>> {
  const out: Array<{ platKey: string; recaps: BuildingRecap[] }> = [];
  for (const plat of plats) {
    out.push({
      platKey: platKeyStr(plat),
      recaps: await fetchBuildingRecap(plat),
    });
  }
  return out;
}

function isMainBuilding(t: BuildingTitle): boolean {
  if (t.mainAtchGbCd === '1') return false;
  if (t.mainAtchGbCdNm?.includes('부속')) return false;
  return true;
}

function isResidentialBuilding(t: BuildingTitle): boolean {
  const purps = `${t.mainPurpsCdNm ?? ''} ${t.etcPurps ?? ''}`;
  return /공동주택|아파트|주택|연립|다세대|맨션/i.test(purps);
}

function isResidentialDongName(dongName: string | null): boolean {
  if (!dongName) return false;
  const name = dongName.replace(/\s+/g, '');
  if (
    /관리|주차|경로|보육|상가|경비|주민|시설|기계|전기|펌프|공동/i.test(name)
  ) {
    return false;
  }
  return /동$/.test(name) || /^\d+$/.test(name);
}

/** 아파트 동 수 — 101동·102동 등 세대가 있는 주거 동만 */
export function countResidentialDongs(
  titles: BuildingTitle[],
  canonicalName?: string,
): number {
  const dongs = new Set<string>();
  for (const t of titles) {
    if (
      canonicalName &&
      t.buildingName &&
      !sameComplexBuildingName(t.buildingName, canonicalName)
    ) {
      continue;
    }
    if (!isResidentialDongName(t.dongName)) continue;
    if (titleHouseholdCount(t) <= 0) continue;
    dongs.add(t.dongName!);
  }
  return dongs.size;
}

function shouldRefineHouseholdCount(
  refined: number,
  householdCount: number,
  fromRecap: { householdCount: number; buildingCount: number },
  fromTitles: { householdCount: number; buildingCount: number },
): boolean {
  if (refined <= 0) return false;
  if (householdCount === 0) return true;

  const multiBuilding =
    fromRecap.buildingCount > 1 || fromTitles.buildingCount > 1;
  if (multiBuilding) return false;

  return refined < householdCount;
}

/** 단지명 매칭 실패 시 주건축물·주거용 표제부 합산 */
function sumResidentialMainTitles(
  titles: BuildingTitle[],
): { householdCount: number; buildingCount: number } {
  const rows = titles.filter(
    (t) => isMainBuilding(t) && isResidentialBuilding(t),
  );
  let householdCount = 0;
  const dongs = new Set<string>();
  for (const t of rows) {
    if (t.dongName && !isResidentialDongName(t.dongName)) continue;
    const n = titleHouseholdCount(t);
    if (n > 0) householdCount += n;
    if (t.dongName) dongs.add(t.dongName);
  }
  if (householdCount > 0) {
    const residentialDongs = [...dongs].filter((d) => isResidentialDongName(d));
    return {
      householdCount,
      buildingCount:
        residentialDongs.length > 0
          ? residentialDongs.length
          : dongs.size > 0
            ? dongs.size
            : rows.length || 1,
    };
  }

  const mainWithCount = titles.filter(
    (t) => isMainBuilding(t) && titleHouseholdCount(t) > 0,
  );
  if (mainWithCount.length === 1) {
    return {
      householdCount: titleHouseholdCount(mainWithCount[0]),
      buildingCount: 1,
    };
  }

  return { householdCount: 0, buildingCount: 0 };
}

function sumKnownTitles(
  titles: BuildingTitle[],
  canonicalName: string,
): { householdCount: number; buildingCount: number } {
  let householdCount = 0;
  const dongs = new Set<string>();
  let buildingRows = 0;

  for (const t of titles) {
    if (
      !t.buildingName ||
      !sameComplexBuildingName(t.buildingName, canonicalName)
    ) {
      continue;
    }
    if (t.dongName && !isResidentialDongName(t.dongName)) continue;
    if (titleHouseholdCount(t)) householdCount += titleHouseholdCount(t);
    if (t.dongName) dongs.add(t.dongName);
    else if (t.buildingName) buildingRows += 1;
  }

  if (householdCount > 0) {
    const residentialDongs = [...dongs].filter((d) => isResidentialDongName(d));
    return {
      householdCount,
      buildingCount:
        residentialDongs.length > 0
          ? residentialDongs.length
          : dongs.size > 0
            ? dongs.size
            : buildingRows || 1,
    };
  }

  const withCount = titles.filter((t) => titleHouseholdCount(t) > 0);
  if (withCount.length === 1) {
    return {
      householdCount: titleHouseholdCount(withCount[0]),
      buildingCount: withCount[0].dongName ? 1 : 1,
    };
  }

  let unnamedSum = 0;
  for (const t of withCount) {
    if (!t.buildingName) unnamedSum += titleHouseholdCount(t);
  }
  if (unnamedSum > 0) {
    return { householdCount: unnamedSum, buildingCount: dongs.size || 1 };
  }

  return { householdCount: 0, buildingCount: 0 };
}

async function sumTitleScale(
  plats: PlatKey[],
  canonicalName: string,
  options?: { strictName?: boolean },
): Promise<{ householdCount: number; buildingCount: number }> {
  let householdCount = 0;
  const dongs = new Set<string>();
  let buildingRows = 0;

  for (const plat of plats) {
    const { titles } = await fetchBuildingTitles({
      sigunguCd: plat.sigunguCd,
      bjdongCd: plat.bjdongCd,
      bun: plat.bun,
      ji: plat.ji,
      mountain: plat.mountain,
    });
    for (const t of titles) {
      if (options?.strictName) {
        if (
          !t.buildingName ||
          !sameComplexBuildingName(t.buildingName, canonicalName)
        ) {
          continue;
        }
      } else if (
        t.buildingName &&
        !sameComplexBuildingName(t.buildingName, canonicalName)
      ) {
        continue;
      }
      if (t.dongName && !isResidentialDongName(t.dongName)) continue;
      if (titleHouseholdCount(t)) householdCount += titleHouseholdCount(t);
      if (t.dongName) dongs.add(t.dongName);
      else if (t.buildingName) buildingRows += 1;
    }
  }

  const residentialDongs = [...dongs].filter((d) => isResidentialDongName(d));
  return {
    householdCount,
    buildingCount:
      residentialDongs.length > 0
        ? residentialDongs.length
        : dongs.size > 0
          ? dongs.size
          : buildingRows,
  };
}

async function scaleFromPlats(
  plats: PlatKey[],
  seedKey: string,
  canonicalName: string,
  seedTitles?: BuildingTitle[],
): Promise<{ householdCount: number; buildingCount: number }> {
  const platRecaps = await fetchRecapsByPlat(plats);
  const fromRecap = aggregateRecapTotalsByPlat(
    platRecaps,
    seedKey,
    canonicalName,
  );
  let fromTitles =
    plats.length === 1 && seedTitles?.length
      ? sumKnownTitles(seedTitles, canonicalName)
      : await sumTitleScale(plats, canonicalName, { strictName: true });

  if (fromTitles.householdCount === 0 && seedTitles?.length) {
    fromTitles = sumResidentialMainTitles(seedTitles);
  }

  const wide = preferComplexWideScale(fromRecap, fromTitles);
  let householdCount = wide.householdCount;
  let buildingCount = wide.buildingCount;

  if (plats.length === 1 && buildingCount <= 1) {
    const plat = plats[0];
    const [exclusiveCount, exposCount] = await Promise.all([
      countExclusiveResidentialUnits(plat),
      countExposUnits(plat),
    ]);
    const refined =
      exclusiveCount > 0
        ? exclusiveCount
        : exposCount > 0
          ? exposCount
          : 0;
    if (
      shouldRefineHouseholdCount(
        refined,
        householdCount,
        fromRecap,
        fromTitles,
      )
    ) {
      householdCount = refined;
    }
  }

  if (plats.length === 1 && seedTitles?.length) {
    const residentialDongs = countResidentialDongs(
      seedTitles,
      canonicalName,
    );
    if (residentialDongs > buildingCount) {
      buildingCount = residentialDongs;
    }
  }

  return { householdCount, buildingCount };
}

export async function fetchComplexScale(input: {
  propType: PropType;
  canonicalName: string;
  seedPlat: PlatKey;
  seedTitles: BuildingTitle[];
  address?: string;
}): Promise<ComplexScale | null> {
  if (input.propType === '다가구') return null;

  const seedKey = platKeyStr(input.seedPlat);

  let plats = [input.seedPlat];
  let totals = await scaleFromPlats(
    plats,
    seedKey,
    input.canonicalName,
    input.seedTitles,
  );

  if (shouldExpandComplexPlats(totals) && input.seedPlat.ji !== '0000') {
    const parentPlat = { ...input.seedPlat, ji: '0000' };
    totals = pickLargerComplexScale(
      totals,
      await scaleFromPlats(
        [parentPlat],
        platKeyStr(parentPlat),
        input.canonicalName,
      ),
    );
  }

  if (shouldExpandComplexPlats(totals)) {
    const attached = await fetchAttachedPlats(input.seedPlat);
    const attachedPlats = collectPlatKeys(input.seedPlat, attached, []);
    if (attachedPlats.length > 1) {
      plats = attachedPlats;
      totals = pickLargerComplexScale(
        totals,
        await scaleFromPlats(plats, seedKey, input.canonicalName),
      );
    }
  }

  if (
    shouldExpandComplexPlats(totals) &&
    input.propType === '아파트'
  ) {
    const namedRecaps = await fetchNamedRecapsInBjdong({
      sigunguCd: input.seedPlat.sigunguCd,
      bjdongCd: input.seedPlat.bjdongCd,
      canonicalName: input.canonicalName,
    });
    if (namedRecaps.length > 0) {
      totals = pickLargerComplexScale(
        totals,
        aggregateNamedRecaps(namedRecaps),
      );
    }
  }

  if (
    shouldExpandComplexPlats(totals) &&
    input.propType === '아파트' &&
    addressDeclaresComplex(input.address, input.canonicalName)
  ) {
    const sigunguRecaps = await fetchNamedRecapsInSigungu({
      sigunguCd: input.seedPlat.sigunguCd,
      canonicalName: input.canonicalName,
    });
    if (sigunguRecaps.length > 0) {
      totals = pickLargerComplexScale(
        totals,
        aggregateNamedRecaps(sigunguRecaps),
      );
    }
  }

  if (
    shouldExpandComplexPlats(totals) &&
    input.propType === '아파트'
  ) {
    const named = await fetchNamedComplexInBjdong({
      sigunguCd: input.seedPlat.sigunguCd,
      bjdongCd: input.seedPlat.bjdongCd,
      canonicalName: input.canonicalName,
    });
    if (named.titles.length > 0) {
      plats = collectPlatKeys(input.seedPlat, [], named.plats);
      totals = pickLargerComplexScale(
        totals,
        sumKnownTitles(named.titles, input.canonicalName),
      );
    }
  }

  const { householdCount, buildingCount } = totals;

  if (householdCount === 0 && buildingCount === 0) return null;

  return {
    complexName: input.canonicalName,
    householdCount,
    buildingCount,
    parcelCount: plats.length,
  };
}
