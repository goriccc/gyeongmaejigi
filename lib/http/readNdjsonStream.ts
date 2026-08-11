import { formatHttpErrorMessage } from './readJsonSafe';

function parseNdjsonLine<T>(line: string, status: number): T {
  try {
    return JSON.parse(line) as T;
  } catch {
    throw new Error(formatHttpErrorMessage(status, line));
  }
}

function isNdjsonContentType(contentType: string): boolean {
  return (
    contentType.includes('application/x-ndjson') ||
    contentType.includes('application/json')
  );
}

/**
 * NDJSON(한 줄당 JSON 객체) 스트림을 읽어 이벤트를 콜백으로 전달합니다.
 */
export async function readNdjsonStream<T extends { type: string }>(
  res: Response,
  onEvent: (event: T) => void,
): Promise<void> {
  const contentType = res.headers.get('content-type') ?? '';

  if (!res.ok && !isNdjsonContentType(contentType)) {
    const raw = await res.text();
    throw new Error(formatHttpErrorMessage(res.status, raw, res.statusText));
  }

  if (!res.body) {
    throw new Error(
      res.ok
        ? '서버 응답 스트림이 없습니다.'
        : formatHttpErrorMessage(res.status, '', res.statusText),
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      onEvent(parseNdjsonLine<T>(trimmed, res.status));
    }
  }

  const last = buffer.trim();
  if (last) {
    onEvent(parseNdjsonLine<T>(last, res.status));
  }
}
