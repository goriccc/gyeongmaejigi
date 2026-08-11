'use client';

import Link from 'next/link';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { FieldRouteSection } from '@/components/field/FieldRouteSection';
import { useCases } from '@/lib/hooks/useCases';
import { ko } from '@/messages/ko';

export default function FieldPrepPage() {
  const { activeCase } = useCases();
  const hasRiskFlags = Boolean(activeCase?.riskFlags?.length);

  return (
    <>
      <div className="chapter-mark">제3장 · 임장 준비</div>
      <h1 className="page-title">
        가기 전에,
        <br />
        <em>뭘 봐야 할지</em> 압니다.
      </h1>
      <p className="page-sub">
        입찰 마감일을 우선해 하루 임장 건수만큼 동선을 짜고, 지도에서 순번을
        눌러 해당 물건을 확인할 수 있습니다. 소재지는 사건 추가 시
        법원경매정보에서 불러온 주소를 사용합니다.
      </p>

      {!hasRiskFlags && activeCase ? (
        <div className="banner">
          제2장 권리분석을 아직 하지 않으셨습니다.{' '}
          <Link href="/b">대조체크를 진행</Link>하면 이 물건에 맞는 확인 항목이
          추가됩니다.
        </div>
      ) : null}

      <FieldRouteSection />

      <p className="notice-inline">
        {ko.caseForm.lookupHint} 자차·대중교통 경로는 카카오 API 기준이며, 현장
        출발 전 지도에서 위치를 다시 확인하세요.
      </p>

      <Disclaimer>
        관리사무소 운영시간처럼 현장에서만 확인되는 정보는 포함되지 않습니다.
        사전 전화 확인을 권합니다.
      </Disclaimer>
    </>
  );
}
