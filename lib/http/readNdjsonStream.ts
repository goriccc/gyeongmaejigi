/**
 * NDJSON(한 줄당 JSON 객체) 스트림을 읽어 이벤트를 콜백으로 전달합니다.
 */
export async function readNdjsonStream<T extends { type: string }>(
  res: Response,
  onEvent: (event: T) => void,
): Promise<void> {
  if (!res.body) {
    throw new Error('서버 응답 스트림이 없습니다.');
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
      onEvent(JSON.parse(trimmed) as T);
    }
  }

  const last = buffer.trim();
  if (last) {
    onEvent(JSON.parse(last) as T);
  }
}
