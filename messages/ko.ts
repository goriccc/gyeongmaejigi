export const ko = {
  brand: '경매지기',
  tagline: '입찰 전, 한 번 더 확인하세요',
  nav: {
    dashboard: '투자상담',
    a: '입찰사건',
    b: '권리분석',
    c: '임장준비',
    d: '입찰가계산',
    f: '대출비교',
    e: '명도코칭',
  },
  rail: {
    index: '사건 진행 목차',
    cover: '투자 상담',
    ch1: '입찰사건',
    ch2: '권리분석',
    ch3: '임장 준비',
    ch4: '입찰가 계산',
    ch5: '대출상품 비교',
    ch6: '명도 코칭',
  },
  dashboard: {
    mark: '제1장 · 입찰사건',
    titleBefore: '입찰 전,',
    titleEm: '한 번 더',
    titleAfter: ' 확인하세요.',
    lead: '시드머니 확인부터 임장, 입찰가 산정, 명도까지 — 경매 한 건이 끝날 때까지의 전 과정을 잇습니다. 판단은 항상 본인 몫이고, 저희는 놓친 부분을 짚어드립니다.',
    cta: '설정 · 투자 상담 시작 →',
    ctaEviction: '명도 코칭만 이용 →',
    nextTask: (label: string) => `다음 할 일: ${label} →`,
    lifecycle: '활성 사건 진행',
    groupThisWeek: '이번 주 입찰',
    groupReviewing: '검토 중',
    groupEviction: '명도 진행',
    groupArchived: '종료',
    docket: '전체 사건',
    emptyTitle: '사건이 없습니다',
    emptyLead: '입찰 준비 또는 명도 코칭만 필요한 경우 새 사건을 추가하세요.',
    addCase: '+ 입찰 사건 추가',
    addEviction: '+ 명도만 시작',
    deleteCase: '삭제',
    selectCase: '권리분석',
    active: '작업 중',
    archivedToggle: (n: number) => `종료된 사건 ${n}건`,
  },
  caseForm: {
    title: '입찰 사건 추가',
    court: '법원',
    courtPh: '법원 선택',
    name: '물건명',
    address: '소재지',
    caseNumber: '사건번호',
    caseYear: '사건 연도',
    caseType: '타경',
    caseSerial: '일련번호',
    caseSerialPh: '115901',
    caseNumberPh: '2026타경1234',
    appraisal: '감정가 (원)',
    bidDeposit: '입찰보증금 (원)',
    auctionRound: '금번 회차',
    minimumSalePrice: '최저매각가격 (원)',
    auctionDate: '매각기일',
    lookup: '정보 불러오기',
    lookupLoading: '조회 중…',
    lookupLead:
      '법원을 선택하고 연도·일련번호를 입력한 뒤 Enter 또는 「정보 불러오기」를 누르세요.',
    lookupHint:
      '출처: 법원경매정보(courtauction.go.kr). 입찰 전 원문 공고·명세서를 반드시 확인하세요.',
    submit: '사건 생성',
    cancel: '취소',
  },
  caseView: {
    title: '입찰 사건 보기',
    close: '닫기',
  },
  evictionForm: {
    title: '명도 코칭 시작',
    name: '물건·별칭',
    namePh: '동탄 ○○아파트 / A낙찰 건',
    clientLabel: '의뢰 구분 (선택)',
    clientLabelPh: '김○○ 의뢰',
    privacyNote:
      '타인 명의 물건을 대신 입력하는 경우, 개인정보는 최소화해 주세요.',
    submit: '명도 코칭 시작',
    cancel: '취소',
  },
  contextBar: {
    noCase: '작업 중인 사건 없음',
    switch: '사건 전환',
    trackBidding: '입찰 준비',
    trackEviction: '명도',
  },
  bidOutcome: {
    title: '입찰 결과',
    won: '낙찰',
    lost: '유찰',
    skipped: '입찰 안 함',
    wonNote:
      '낙찰 축하합니다. 다른 입찰 예정 물건은 그대로 준비할 수 있습니다.',
    pendingHint: '매각기일 이후 결과를 선택해 주세요.',
  },
  entryProfile: {
    globalHint:
      '입찰 조건은 기기에 저장됩니다. 활성 입찰 사건에도 동일하게 적용됩니다.',
    noCaseHint:
      '활성 사건 없음 — 입찰 조건은 기기에 저장되며, 사건 선택 시 물건에도 반영됩니다.',
  },
  evictionBanner: {
    noCase: '사건을 만들면 분석 결과가 저장됩니다. 지금도 대화 분석은 가능합니다.',
    ready: '대화를 붙여넣어 누적하고, 필요할 때마다 재분석하세요.',
    biddingPrep:
      '입찰 준비 중인 사건입니다. 명도 분석은 지금도 가능합니다.',
    promote: '명도 단계로 전환',
  },
  common: {
    activeCount: (bidding: number, eviction: number) => {
      const parts: string[] = [];
      if (bidding > 0) parts.push(`입찰 준비 ${bidding}건`);
      if (eviction > 0) parts.push(`명도 ${eviction}건`);
      return parts.length ? parts.join(' · ') : '진행중 사건 없음';
    },
    noActiveCase: '활성 사건 없음 — 계산은 가능하지만 물건별 저장은 되지 않습니다.',
    promoteToE: '명도 단계로 전환',
    promoteToF: '대출상품 비교',
    completeEviction: '명도 완료',
    preparing: '준비중',
    loading: '분석 중…',
    copy: '복사',
    copied: '복사됨',
  },
} as const;

export type Messages = typeof ko;
