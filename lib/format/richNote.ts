export type RichNoteSegment =
  | { type: 'text'; value: string }
  | { type: 'key'; value: string }
  | { type: 'warn'; value: string };

/** 유사 유니코드 → ASCII 마커 */
export function normalizeRichNoteMarkers(input: string): string {
  return input
    .replace(/[\u2217\u204E\u066D\uFE61\uFF0A\u2731]/g, '*') // ∗⁎٭﹡＊✱
    .replace(/\u203C/g, '!!') // ‼
    .replace(/\uFF01/g, '!') // ！
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, '');
}

/**
 * **핵심** → key, !!경고!! → warn
 * 닫는 !! 없이 !! 또는 【경고】로 시작하면 끝까지 warn
 */
export function parseRichNote(text: string): RichNoteSegment[] {
  if (!text) return [];

  const src = normalizeRichNoteMarkers(text);
  const segments: RichNoteSegment[] = [];
  let i = 0;

  const pushText = (value: string) => {
    if (value) segments.push({ type: 'text', value });
  };

  while (i < src.length) {
    // !!warn!! 또는 미닫힘 !!…
    if (src.startsWith('!!', i)) {
      const close = src.indexOf('!!', i + 2);
      if (close !== -1) {
        segments.push({ type: 'warn', value: src.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
      // 닫는 마커 없음 → 끝까지 경고
      segments.push({ type: 'warn', value: src.slice(i + 2) });
      break;
    }

    // 【경고】… (미닫힘, 끝까지)
    if (src.startsWith('【경고】', i)) {
      segments.push({ type: 'warn', value: src.slice(i) });
      break;
    }

    // **key**
    if (src.startsWith('**', i)) {
      const close = src.indexOf('**', i + 2);
      if (close !== -1) {
        segments.push({ type: 'key', value: src.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
      // 닫힘 없으면 일반 텍스트로
      pushText('**');
      i += 2;
      continue;
    }

    // 다음 마커까지 일반 텍스트
    let next = src.length;
    const nextBang = src.indexOf('!!', i);
    const nextBold = src.indexOf('**', i);
    const nextWarnLabel = src.indexOf('【경고】', i);
    for (const idx of [nextBang, nextBold, nextWarnLabel]) {
      if (idx !== -1 && idx < next) next = idx;
    }
    pushText(src.slice(i, next));
    i = next;
  }

  return segments;
}

/** 마커가 화면에 남는지 검증용 */
export function richNoteHasRawMarkers(text: string): boolean {
  const joined = parseRichNote(text)
    .filter((s) => s.type === 'text')
    .map((s) => s.value)
    .join('');
  return /\*\*|!!/.test(joined);
}
