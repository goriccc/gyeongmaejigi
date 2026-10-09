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

/** 권리분석 — PDF 다건 + adaptive thinking(high). 라우트 maxDuration보다 짧아야 함 */
export const RIGHTS_LLM_TIMEOUT_MS = 240_000;

/** 권리분석 브라우저 요청 — 서버 LLM 타임아웃보다 길고 maxDuration(300초)보다 짧게 */
export const RIGHTS_CLIENT_TIMEOUT_MS = 280_000;

/** 명도코칭 — adaptive thinking(high). 라우트 maxDuration보다 짧아야 함 */
export const EVICTION_LLM_TIMEOUT_MS = 180_000;

/** 명도코칭 브라우저 요청 — 서버 LLM 타임아웃보다 길고 maxDuration(300초)보다 짧게 */
export const EVICTION_CLIENT_TIMEOUT_MS = 220_000;
