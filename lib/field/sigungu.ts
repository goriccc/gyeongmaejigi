/**
 * 주소 문자열에서 시·군·구 키를 뽑습니다.
 * 예: "경기도 고양시 덕양구 …" → "고양시 덕양구"
 *     "서울특별시 양천구 …" → "서울 양천구"
 *     "경기도 평택시 …" → "평택시"
 */
export function extractSigunguKey(address: string | undefined | null): string {
  const text = (address ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '지역미상';

  const siGu = text.match(
    /([가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도))\s+([가-힣]+시)\s+([가-힣]+구)(?=\s|$)/,
  );
  if (siGu) return `${siGu[2]} ${siGu[3]}`;

  const metroGu = text.match(
    /([가-힣]+(?:특별시|광역시))\s+([가-힣]+구)(?=\s|$)/,
  );
  if (metroGu) {
    const city = metroGu[1]
      .replace(/특별시$/, '')
      .replace(/광역시$/, '');
    return `${city} ${metroGu[2]}`;
  }

  if (/세종특별자치시/.test(text)) return '세종특별자치시';

  const si = text.match(/([가-힣]+시)(?=\s|$)/);
  if (
    si &&
    !/(특별시|광역시|자치시)$/.test(si[1]) &&
    !/(특별자치시)$/.test(si[1])
  ) {
    return si[1];
  }

  const gun = text.match(/([가-힣]+군)(?=\s|$)/);
  if (gun) return gun[1];

  return '지역미상';
}

export function shortenSigunguLabel(key: string): string {
  if (key === '지역미상') return key;
  return key.replace(/^서울\s/, '').replace(/^세종특별자치시$/, '세종');
}
