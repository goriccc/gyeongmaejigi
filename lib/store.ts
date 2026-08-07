import type { CaseFile, CreateCaseInput } from '@/types/case';

export const CASES_KEY = 'gyeongmaejigi:cases';
export const ACTIVE_CASE_KEY = 'gyeongmaejigi:activeCaseId';

export interface CaseStore {
  getAll(): CaseFile[];
  getById(id: string): CaseFile | undefined;
  create(input: CreateCaseInput): CaseFile;
  update(id: string, patch: Partial<CaseFile>): CaseFile | undefined;
  remove(id: string): void;
  getActiveId(): string | null;
  setActiveId(id: string | null): void;
}

function readCases(): CaseFile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CaseFile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCases(cases: CaseFile[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 1단계 localStorage 구현체 — 2단계에서 Supabase 구현체로 교체 가능 */
export const localCaseStore: CaseStore = {
  getAll() {
    return readCases();
  },

  getById(id) {
    return readCases().find((c) => c.id === id);
  },

  create(input) {
    const cases = readCases();
    const created: CaseFile = {
      id: createId(),
      name: input.name.trim(),
      caseNumber: input.caseNumber.trim(),
      stage: 'A',
      appraisalValue: input.appraisalValue,
      auctionDate: input.auctionDate,
      riskFlags: [],
      checklist: [],
    };
    cases.unshift(created);
    writeCases(cases);
    if (!localStorage.getItem(ACTIVE_CASE_KEY)) {
      localStorage.setItem(ACTIVE_CASE_KEY, created.id);
    }
    return created;
  },

  update(id, patch) {
    const cases = readCases();
    const idx = cases.findIndex((c) => c.id === id);
    if (idx < 0) return undefined;
    const next = { ...cases[idx], ...patch, id };
    cases[idx] = next;
    writeCases(cases);
    return next;
  },

  remove(id) {
    const cases = readCases().filter((c) => c.id !== id);
    writeCases(cases);
    const active = localStorage.getItem(ACTIVE_CASE_KEY);
    if (active === id) {
      localStorage.setItem(ACTIVE_CASE_KEY, cases[0]?.id ?? '');
      if (!cases[0]) localStorage.removeItem(ACTIVE_CASE_KEY);
    }
  },

  getActiveId() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_CASE_KEY);
  },

  setActiveId(id) {
    if (typeof window === 'undefined') return;
    if (!id) {
      localStorage.removeItem(ACTIVE_CASE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_CASE_KEY, id);
  },
};
