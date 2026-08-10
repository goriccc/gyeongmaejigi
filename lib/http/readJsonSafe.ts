/**
 * Response를 JSON으로 파싱합니다. HTML/텍스트(Internal Server Error 등)면 읽기 쉬운 에러로 변환합니다.
 */
export async function readJsonSafe<T>(res: Response): Promise<T> {
  const raw = await res.text();
  if (!raw) {
    throw new Error(
      res.ok
        ? '서버 응답이 비어 있습니다.'
        : `서버 오류 (${res.status} ${res.statusText})`,
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    const snippet = raw.replace(/\s+/g, ' ').slice(0, 180);
    throw new Error(
      `서버가 JSON이 아닌 응답을 반환했습니다 (${res.status}): ${snippet}`,
    );
  }
}
