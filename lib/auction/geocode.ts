/** 도로명·지번 주소 → WGS84 좌표 (임장 동선 지도용) */

export type GeoPoint = { lat: number; lng: number };

export type AddressGeo = GeoPoint & {
  bCode?: string;
  bun?: string;
  ji?: string;
  mountain?: boolean;
  buildingName?: string;
};

type KakaoAddressDoc = {
  y?: string;
  x?: string;
  address?: {
    b_code?: string;
    main_address_no?: string;
    sub_address_no?: string;
    mountain_yn?: string;
  };
  road_address?: {
    building_name?: string;
    main_address_no?: string;
    sub_address_no?: string;
    mountain_yn?: string;
  };
};

async function coordToAddressDetail(
  lat: number,
  lng: number,
  kakaoKey: string,
): Promise<AddressGeo | null> {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { documents?: KakaoAddressDoc[] };
    const doc = data.documents?.[0];
    if (!doc) return null;
    const geo = fromKakaoDoc(doc, { lat, lng });
    return geo;
  } catch {
    return null;
  }
}

function fromKakaoDoc(
  doc: KakaoAddressDoc,
  coords?: GeoPoint,
): AddressGeo | null {
  const addr = doc.address;
  const road = doc.road_address;
  const lat = Number(doc.y ?? coords?.lat);
  const lng = Number(doc.x ?? coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) {
    return null;
  }
  return {
    lat,
    lng,
    bCode: addr?.b_code || undefined,
    bun: addr?.main_address_no || road?.main_address_no || undefined,
    ji: addr?.sub_address_no || road?.sub_address_no || undefined,
    mountain: addr?.mountain_yn === 'Y' || road?.mountain_yn === 'Y',
    buildingName: road?.building_name || undefined,
  };
}

async function enrichGeoWithCoordLookup(
  geo: AddressGeo,
  kakaoKey: string,
): Promise<AddressGeo> {
  if (geo.bCode && geo.bCode.length >= 10 && geo.bun) return geo;
  const enriched = await coordToAddressDetail(geo.lat, geo.lng, kakaoKey);
  if (!enriched?.bCode) return geo;
  return {
    ...geo,
    bCode: enriched.bCode,
    bun: geo.bun ?? enriched.bun,
    ji: geo.ji ?? enriched.ji,
    mountain: geo.mountain ?? enriched.mountain,
    buildingName: geo.buildingName ?? enriched.buildingName,
  };
}

/** 동·층·호·단지명이 붙은 경매 소재지 → 지번 조회용 후보 */
export function geocodeQueryCandidates(address: string): string[] {
  const trimmed = address.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  const add = (value: string) => {
    const q = value.trim();
    if (q.length >= 4 && !out.includes(q)) out.push(q);
  };

  add(trimmed);

  const lotMatch = trimmed.match(/^(.*?[동읍면리]\s+\d+(?:-\d+)?)/);
  if (lotMatch?.[1]) add(lotMatch[1]);

  return out;
}

async function kakaoAddressSearch(
  query: string,
  kakaoKey: string,
): Promise<AddressGeo | null> {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { documents?: KakaoAddressDoc[] };
    const geo = data.documents?.[0] ? fromKakaoDoc(data.documents[0]) : null;
    return geo ? enrichGeoWithCoordLookup(geo, kakaoKey) : null;
  } catch {
    return null;
  }
}

async function kakaoKeywordSearch(
  query: string,
  kakaoKey: string,
): Promise<AddressGeo | null> {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      documents?: Array<{ y?: string; x?: string }>;
    };
    const geo = data.documents?.[0]
      ? fromKakaoDoc(data.documents[0] as KakaoAddressDoc)
      : null;
    return geo ? enrichGeoWithCoordLookup(geo, kakaoKey) : null;
  } catch {
    return null;
  }
}

function geoHasParcel(geo: AddressGeo | null): geo is AddressGeo {
  return Boolean(geo?.bCode && geo.bCode.length >= 10 && geo.bun);
}

export async function geocodeAddressDetail(
  address: string,
): Promise<AddressGeo | null> {
  const queries = geocodeQueryCandidates(address);
  if (queries.length === 0) return null;

  const kakaoKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (kakaoKey) {
    for (const query of queries) {
      const byAddress = await kakaoAddressSearch(query, kakaoKey);
      if (geoHasParcel(byAddress)) return byAddress;
    }
    for (const query of queries) {
      const byKeyword = await kakaoKeywordSearch(query, kakaoKey);
      if (geoHasParcel(byKeyword)) return byKeyword;
    }
    for (const query of queries) {
      const byAddress = await kakaoAddressSearch(query, kakaoKey);
      if (byAddress) return byAddress;
    }
    for (const query of queries) {
      const byKeyword = await kakaoKeywordSearch(query, kakaoKey);
      if (byKeyword) return byKeyword;
    }
  }

  const query = queries[0];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'gyeongmaejigi/0.1 (field route map)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = data[0];
    if (hit?.lat && hit?.lon) {
      const geo = {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
      };
      if (kakaoKey) {
        return enrichGeoWithCoordLookup(geo, kakaoKey);
      }
      return geo;
    }
  } catch {
    return null;
  }

  return null;
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  return geocodeAddressDetail(address);
}
