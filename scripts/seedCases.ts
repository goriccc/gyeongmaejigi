/**
 * 개발 확인용 시드 데이터.
 * 앱 최초 실행 흐름에는 포함하지 않습니다.
 * 브라우저 콘솔에서 필요 시 수동으로 localStorage에 주입할 때 참고하세요.
 */
import type { CaseFile } from '@/types/case';

export const DEV_SEED_CASES: CaseFile[] = [
  {
    id: 'seed-dongtan',
    name: '화성시 동탄 ○○아파트',
    caseNumber: '2026타경1123',
    stage: 'B',
    appraisalValue: 667_000_000,
    auctionDate: '2026-08-21',
    riskFlags: [],
    checklist: [],
  },
  {
    id: 'seed-guri',
    name: '구리시 ○○다세대',
    caseNumber: '2026타경0847',
    stage: 'A',
    appraisalValue: 310_000_000,
    auctionDate: '2026-08-28',
    riskFlags: [],
    checklist: [],
  },
];

/** 브라우저 콘솔용 주입 스니펫 (복사용) */
export const SEED_INJECT_SNIPPET = `
localStorage.setItem('gyeongmaejigi:cases', JSON.stringify(${JSON.stringify(DEV_SEED_CASES)}));
localStorage.setItem('gyeongmaejigi:activeCaseId', 'seed-dongtan');
location.reload();
`;
