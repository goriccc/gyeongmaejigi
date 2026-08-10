/**
 * fetch에 타임아웃을 걸습니다. 초과 시 AbortError.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`요청 시간 초과 (${Math.round(timeoutMs / 1000)}초)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** LLM 단건 호출 타임아웃 (thinking 포함) */
export const LLM_TIMEOUT_MS = 90_000;
