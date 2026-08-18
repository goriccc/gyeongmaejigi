/** RTMS 단지명·사건명 매칭용 정규화 */

const STRIP = /아파트|단지|주상복합|오피스텔|빌라|연립|주택/g;

function isResidentialName(name: string): boolean {
  if (/학교|병원|교회|시장|공원|체육|센터|주차/i.test(name)) return false;
  return (
    looksLikeComplexName(name) ||
    /아파트|연립|주택|빌라|맨션|타워|오피스텔|주상/i.test(name)
  );
}

/** 공공데이터 단지명 엄격 비교 — 공백만 제거, 1차·2차 등은 그대로 구분 */
export function canonicalNamesEqual(a: string, b: string): boolean {
  const strip = (s: string) => s.trim().replace(/\s+/g, '');
  const x = strip(a);
  const y = strip(b);
  return x.length > 0 && x === y;
}

const GENERIC_BUILDING_NAME =
  /^(공동주택|아파트|연립주택|다세대|다가구|근린생활|업무시설|숙박|제\d+종)/;

export function isUsableComplexName(name: string): boolean {
  const t = name.trim();
  if (t.length < 2) return false;
  if (GENERIC_BUILDING_NAME.test(t)) return false;
  return true;
}

/** 단지명 매칭 — 공백·아파트 접미사 차이 허용 */
export function complexNameMatches(a: string, b: string): boolean {
  if (canonicalNamesEqual(a, b)) return true;
  return namesLikelyMatch(a, b);
}

/** 법정동 전체 검색용 — 1차·2차는 구분, 아파트 접미사·동번호만 무시 */
export function stripDongHoFromComplexName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '')
    .replace(/\(\d+동\)$/g, '')
    .replace(/제?\d+동$/g, '')
    .replace(/(아파트|단지)$/g, '');
}

/** 표시·검색용 — 동번호·괄호 접미사 제거 후 아파트명 유지 */
export function baseComplexDisplayName(name: string): string {
  const stripped = name
    .trim()
    .replace(/\s+/g, '')
    .replace(/\(\d+동\)$/, '')
    .replace(/제?\d+동$/, '');
  return stripped.length >= 2 ? stripped : name.trim();
}

export function sameComplexBuildingName(a: string, b: string): boolean {
  if (canonicalNamesEqual(a, b)) return true;
  const x = stripDongHoFromComplexName(a);
  const y = stripDongHoFromComplexName(b);
  return x.length >= 2 && x === y;
}

/** 가장 구체적인(긴) 단지명 — 대장·주소 추출명 우선 */
export function pickLongestComplexName(sources: string[]): string | null {
  const filtered = sources.map((s) => s.trim()).filter(isUsableComplexName);
  if (filtered.length === 0) return null;
  return [...filtered].sort((a, b) => b.length - a.length)[0];
}

/** RTMS·대장에서 가장 많이 등장하는 공식 단지명 */
export function pickCanonicalComplexName(sources: string[]): string | null {
  const filtered = sources.map((s) => s.trim()).filter(isUsableComplexName);
  if (filtered.length === 0) return null;

  const counts = new Map<string, number>();
  for (const t of filtered) {
    let key = t;
    for (const existing of counts.keys()) {
      if (complexNameMatches(existing, t)) {
        key = existing.length >= t.length ? existing : t;
        break;
      }
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [name, n] of counts) {
    if (n > bestN || (n === bestN && best && name.length > best.length)) {
      bestN = n;
      best = name;
    }
  }
  return best;
}

/** 대장·실거래명에서 동번호 없는 공식 단지명 */
export function pickBaseComplexName(sources: string[]): string | null {
  const filtered = sources
    .map((s) => s.trim())
    .filter(isUsableComplexName)
    .filter((s) => !isLikelyAddressLine(s));
  if (filtered.length === 0) return null;

  const groups = new Map<string, string[]>();
  for (const name of filtered) {
    const key = stripDongHoFromComplexName(name);
    if (key.length < 2) continue;
    const list = groups.get(key) ?? [];
    list.push(name);
    groups.set(key, list);
  }
  if (groups.size === 0) return null;

  let bestKey = '';
  let bestN = 0;
  for (const [key, members] of groups) {
    if (members.length > bestN) {
      bestN = members.length;
      bestKey = key;
    }
  }

  const members = groups.get(bestKey) ?? [];
  const bare = members.find((m) => {
    const base = baseComplexDisplayName(m);
    return base === m.replace(/\s+/g, '') || /아파트$|단지$/.test(base);
  });
  if (bare) return baseComplexDisplayName(bare);

  const withSuffix = members.find((m) => /아파트|단지/.test(m));
  if (withSuffix) return baseComplexDisplayName(withSuffix);

  return baseComplexDisplayName(members[0]);
}

export function isLikelyAddressLine(s: string): boolean {
  const t = s.trim();
  if (t.length <= 24) return false;
  return /특별시|광역시|특별자치시|특별자치도/.test(t) || /\d+\s*(?:동|읍|면|리)\s+\d/.test(t);
}

/** 경매 소재지 괄호 `(법정동,단지명)` — 시군구 총괄 fallback 대상 */
export function addressDeclaresComplex(
  address: string | undefined,
  canonicalName: string,
): boolean {
  if (!address?.trim()) return false;
  const paren = address.match(/\([^)]*,\s*([^)]+)\)/);
  if (paren?.[1] && sameComplexBuildingName(paren[1], canonicalName)) {
    return true;
  }
  return false;
}

export function resolveOfficialComplexName(input: {
  ledgerNames: string[];
  tradeNames: string[];
  buildingName?: string;
  address?: string;
}): string | null {
  const addressCandidates = input.address
    ? complexNameCandidates({
        caseName: '',
        address: input.address,
        buildingName: input.buildingName,
        ledgerNames: input.ledgerNames,
      })
    : [];

  const namedFromAddress = pickBaseComplexName(addressCandidates);
  if (namedFromAddress) return namedFromAddress;

  const ledger = input.ledgerNames.filter(isUsableComplexName);
  if (ledger.length) {
    const fromLedger = pickBaseComplexName(ledger);
    if (fromLedger) return fromLedger;
  }

  const merged = [
    input.buildingName ?? '',
    ...input.tradeNames,
  ].filter(isUsableComplexName);
  if (merged.length) return pickBaseComplexName(merged);

  return pickBaseComplexName(addressCandidates);
}

export function normalizeComplexName(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(STRIP, '')
    .replace(/[()[\]{}]/g, '')
    .toLowerCase();
}

export function namesLikelyMatch(caseName: string, tradeName: string): boolean {
  const a = normalizeComplexName(caseName);
  const b = normalizeComplexName(tradeName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) {
    return true;
  }
  return false;
}

export function looksLikeComplexName(name: string): boolean {
  return /단지|타운|빌리지|휴먼시아|래미안|힐스테이트|자이|푸르지오|아이파크|e편한세상|더샵|롯데캐슬/i.test(
    name,
  );
}

/** RTMS 단지명이 소재지·건물명 문자열에 포함되는지 */
export function tradeNameInAddress(tradeName: string, address: string): boolean {
  const trade = normalizeComplexName(tradeName);
  const addr = normalizeComplexName(address);
  if (!trade || trade.length < 3 || !addr) return false;
  return addr.includes(trade);
}

/** 사건명·주소·카카오 건물명 등 매칭 후보 */
export function complexNameCandidates(input: {
  caseName: string;
  address?: string;
  buildingName?: string;
  ledgerNames?: string[];
}): string[] {
  const out = new Set<string>();
  const add = (raw?: string) => {
    const t = raw?.trim();
    if (!t || t.length < 2) return;
    out.add(t);
    if (looksLikeComplexName(t)) {
      const brand = t.match(
        /([가-힣A-Za-z0-9]+(?:푸르지오|래미안|힐스테이트|자이|아이파크|e편한세상|더샵|롯데캐슬|휴먼시아)[가-힣A-Za-z0-9]*)/i,
      );
      if (brand?.[1]) out.add(brand[1]);
      return;
    }
    const m = t.match(
      /([\dA-Za-z가-힣]+(?:아파트|단지|타운|빌리지|휴먼시아|래미안|힐스테이트|자이|푸르지오|아이파크|e편한세상|더샵|롯데캐슬)[\dA-Za-z가-힣]*)/i,
    );
    if (m?.[1]) out.add(m[1]);
  };
  const addBuilding = (raw?: string) => {
    const t = raw?.trim();
    if (!t || !isResidentialName(t)) return;
    add(t);
  };

  for (const name of input.ledgerNames ?? []) addBuilding(name);
  addBuilding(input.buildingName);
  add(input.caseName);
  add(input.address);
  if (input.address) {
    const parenTail = input.address.match(/\([^)]*,\s*([^)]+)\)/);
    if (parenTail?.[1]) add(parenTail[1]);
    const tail = input.address
      .replace(/^.*?(?:\d+\s*(?:동|읍|면|리)\s+)/, '')
      .trim();
    if (tail && tail !== input.address) add(tail);
  }
  return [...out];
}
