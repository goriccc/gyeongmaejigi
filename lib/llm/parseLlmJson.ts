/**
 * LLM이 반환한 텍스트에서 JSON을 추출·복구해 파싱합니다.
 * 줄바꿈 미이스케이프, trailing comma 등 흔한 오류를 보정합니다.
 */

export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

/** 스마트 따옴표 등 비표준 문자를 JSON 호환으로 치환 */
function normalizeJsonChars(text: string): string {
  return text
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u00a0/g, ' ');
}

/** 문자열 값 안의 실제 줄바꿈을 \\n으로 이스케이프 */
function escapeNewlinesInStrings(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
      }
      result += '\\n';
      continue;
    }

    if (inString && ch === '\t') {
      result += '\\t';
      continue;
    }

    result += ch;
  }

  return result;
}

/** 배열·객체 닫기 직전 trailing comma 제거 */
function removeTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, '$1');
}

export function repairLlmJson(text: string): string {
  let repaired = normalizeJsonChars(text);
  repaired = escapeNewlinesInStrings(repaired);
  repaired = removeTrailingCommas(repaired);
  return repaired;
}

export function parseLlmJson<T>(raw: string): T {
  const jsonText = extractJsonText(raw);

  try {
    return JSON.parse(jsonText) as T;
  } catch (firstErr) {
    try {
      return JSON.parse(repairLlmJson(jsonText)) as T;
    } catch {
      const msg =
        firstErr instanceof Error ? firstErr.message : 'JSON 파싱 실패';
      throw new Error(msg);
    }
  }
}
