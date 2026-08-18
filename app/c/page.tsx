'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { FieldBriefingSection } from '@/components/field/FieldBriefingSection';
import { FieldRouteSection } from '@/components/field/FieldRouteSection';
import { useCases } from '@/lib/hooks/useCases';

export default function FieldPrepPage() {
  const { cases, activeCase, activeId, setActiveId } = useCases();
  const [focusCaseId, setFocusCaseId] = useState<string | null>(null);
  const [focusOrder, setFocusOrder] = useState<number | null>(null);
  const hasRiskFlags = Boolean(activeCase?.riskFlags?.length);

  const briefingCase = useMemo(() => {
    const id = focusCaseId ?? activeId;
    if (!id) return activeCase;
    return cases.find((c) => c.id === id) ?? activeCase;
  }, [cases, focusCaseId, activeId, activeCase]);

  const focusCase = useCallback(
    (id: string, order?: number) => {
      setFocusCaseId(id);
      setFocusOrder(order && order > 0 ? order : null);
      setActiveId(id);
    },
    [setActiveId],
  );

  return (
    <>
      <div className="chapter-mark">제3장 · 임장 준비</div>
      <h1 className="page-title">
        최적의 <em>임장 동선</em>과
        <br />
        물건 <em>브리핑</em>
      </h1>
      <p className="page-sub">
        동선에서 물건을 고르면 연식·실거래 브리핑이 표시됩니다.
      </p>

      {!hasRiskFlags && activeCase ? (
        <div className="banner">
          제2장 권리분석을 아직 하지 않으셨습니다.{' '}
          <Link href="/b">대조체크를 진행</Link>하면 현장 전에 위험 요소를
          먼저 짚어둘 수 있습니다.
        </div>
      ) : null}

      <FieldRouteSection onFocusCase={focusCase} />
      <FieldBriefingSection
        caseFile={briefingCase}
        stopOrder={briefingCase?.id === focusCaseId ? focusOrder : null}
      />
    </>
  );
}
