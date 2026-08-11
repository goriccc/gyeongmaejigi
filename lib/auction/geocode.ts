/** 도로명·지번 주소 → WGS84 좌표 (임장 동선 지도용) */

export type GeoPoint = { lat: number; lng: number };

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const query = address.trim();
  if (!query) return null;

  const kakaoKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (kakaoKey) {
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
        {
          headers: { Authorization: `KakaoAK ${kakaoKey}` },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          documents?: Array<{ y?: string; x?: string }>;
        };
        const doc = data.documents?.[0];
        if (doc?.y && doc?.x) {
          return { lat: Number(doc.y), lng: Number(doc.x) };
        }
      } else if (kakaoKey && res.status === 401) {
        return null;
      }
    } catch {
      // fallback below
    }

    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`,
        {
          headers: { Authorization: `KakaoAK ${kakaoKey}` },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          documents?: Array<{ y?: string; x?: string }>;
        };
        const doc = data.documents?.[0];
        if (doc?.y && doc?.x) {
          return { lat: Number(doc.y), lng: Number(doc.x) };
        }
      }
    } catch {
      // fallback below
    }
  }

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
      return { lat: Number(hit.lat), lng: Number(hit.lon) };
    }
  } catch {
    return null;
  }

  return null;
}
