import type { EntryMatchInputs, EntryMatchResult } from '@/types/case';

export const ENTRY_PROFILE_KEY = 'gyeongmaejigi:entryProfile';

export type EntryProfile = {
  inputs: EntryMatchInputs;
  result?: EntryMatchResult;
  updatedAt: string;
};

function readRaw(): EntryProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ENTRY_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EntryProfile;
  } catch {
    return null;
  }
}

/** 글로벌 입찰 조건 (설정 · 투자 상담) — 기기별 localStorage */
export function loadEntryProfile(): EntryProfile | null {
  return readRaw();
}

export function saveEntryProfile(
  inputs: EntryMatchInputs,
  result?: EntryMatchResult,
): EntryProfile {
  const profile: EntryProfile = {
    inputs,
    result,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(ENTRY_PROFILE_KEY, JSON.stringify(profile));
  }
  return profile;
}
