'use client';

import Link from 'next/link';
import { FieldRouteSection } from '@/components/field/FieldRouteSection';
import { useCases } from '@/lib/hooks/useCases';

export default function FieldPrepPage() {
  const { activeCase } = useCases();
  const hasRiskFlags = Boolean(activeCase?.riskFlags?.length);

  return (
    <>
      <div className="chapter-mark">제3장 · 임장 준비</div>
      <h1 className="page-title">
        최적의 <em>임장 동선</em>을
        <br />
        짜 드립니다.
      </h1>
      <p className="page-sub">
        입찰 마감일을 우선해 하루 임장 건수만큼 동선을 짜고, 지도에서 순번을
        눌러 해당 물건을 확인할 수 있습니다. 소재지는 사건 추가 시
        법원경매정보에서 불러온 주소를 사용합니다.
      </p>

      {!hasRiskFlags && activeCase ? (
        <div className="banner">
          제2장 권리분석을 아직 하지 않으셨습니다.{' '}
          <Link href="/b">대조체크를 진행</Link>하면 현장 전에 위험 요소를
          먼저 짚어둘 수 있습니다.
        </div>
      ) : null}

      <FieldRouteSection />
    </>
  );
}
