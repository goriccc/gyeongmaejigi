/**
 * Response를 JSON으로 파싱합니다. HTML/텍스트(Internal Server Error 등)면 읽기 쉬운 에러로 변환합니다.
 */
export function formatHttpErrorMessage(
  status: number,
  raw: string,
  statusText = '',
): string {
  const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, 180);
  if (/^internal server error$/i.test(snippet)) {
    return `서버 내부 오류 (${status})가 발생했습니다. 잠시 후 다시 시도하거나 개발 서버를 재시작해 보세요.`;
  }
  if (snippet) {
    return `서버 오류 (${status}): ${snippet}`;
  }
  return statusText
    ? `서버 오류 (${status} ${statusText})`
    : `서버 오류 (${status})`;
}

export async function readJsonSafe<T>(res: Response): Promise<T> {
  const raw = await res.text();
  if (!raw) {
    throw new Error(
      res.ok
        ? '서버 응답이 비어 있습니다.'
        : formatHttpErrorMessage(res.status, '', res.statusText),
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(formatHttpErrorMessage(res.status, raw, res.statusText));
  }
}
