'use client';

import { useEffect, useRef } from 'react';

/**
 * value가 바뀔 때마다 delay ms 후 callback을 호출합니다.
 * resetKey 변경 직후 첫 값은 스킵합니다 (사건 전환·하이드레이션 저장 방지).
 */
export function useDebouncedSave<T>(
  value: T,
  delay: number,
  callback: (value: T) => void,
  enabled = true,
  resetKey?: string | null,
) {
  const cbRef = useRef(callback);
  const skipRef = useRef(true);
  cbRef.current = callback;

  useEffect(() => {
    skipRef.current = true;
  }, [resetKey]);

  useEffect(() => {
    if (!enabled) return;
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      cbRef.current(value);
    }, delay);
    return () => window.clearTimeout(t);
  }, [value, delay, enabled]);
}
