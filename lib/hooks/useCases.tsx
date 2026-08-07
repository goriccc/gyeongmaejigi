'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { localCaseStore, type CaseStore } from '@/lib/store';
import type { CaseFile, CreateCaseInput } from '@/types/case';

type CasesContextValue = {
  cases: CaseFile[];
  activeId: string | null;
  activeCase: CaseFile | null;
  hydrated: boolean;
  createCase: (input: CreateCaseInput) => CaseFile;
  updateCase: (id: string, patch: Partial<CaseFile>) => void;
  removeCase: (id: string) => void;
  setActiveId: (id: string | null) => void;
};

const CasesContext = createContext<CasesContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  store?: CaseStore;
};

export function CasesProvider({
  children,
  store = localCaseStore,
}: ProviderProps) {
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setCases(store.getAll());
    setActiveIdState(store.getActiveId());
  }, [store]);

  useEffect(() => {
    refresh();
    setHydrated(true);
  }, [refresh]);

  const createCase = useCallback(
    (input: CreateCaseInput) => {
      const created = store.create(input);
      store.setActiveId(created.id);
      refresh();
      return created;
    },
    [store, refresh],
  );

  const updateCase = useCallback(
    (id: string, patch: Partial<CaseFile>) => {
      store.update(id, patch);
      refresh();
    },
    [store, refresh],
  );

  const removeCase = useCallback(
    (id: string) => {
      store.remove(id);
      refresh();
    },
    [store, refresh],
  );

  const setActiveId = useCallback(
    (id: string | null) => {
      store.setActiveId(id);
      setActiveIdState(id);
    },
    [store],
  );

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeId) ?? null,
    [cases, activeId],
  );

  const value = useMemo(
    () => ({
      cases,
      activeId,
      activeCase,
      hydrated,
      createCase,
      updateCase,
      removeCase,
      setActiveId,
    }),
    [
      cases,
      activeId,
      activeCase,
      hydrated,
      createCase,
      updateCase,
      removeCase,
      setActiveId,
    ],
  );

  return (
    <CasesContext.Provider value={value}>{children}</CasesContext.Provider>
  );
}

export function useCases(): CasesContextValue {
  const ctx = useContext(CasesContext);
  if (!ctx) {
    throw new Error('useCases must be used within CasesProvider');
  }
  return ctx;
}
