import type { RegZone } from '@/lib/calc/acquisitionTax';

export type CaseStage = 'A' | 'B' | 'C' | 'D' | 'F' | 'E' | 'done';

/** 입찰 준비(A~D) vs 명도 전용(E) */
export type CaseTrack = 'bidding' | 'eviction';

export type BidOutcome = 'pending' | 'won' | 'lost' | 'skipped';

/** 이미 낙찰받은 사건 등록 시 할 일 */
export type PostWinGoals = {
  loanCompare: boolean;
  eviction: boolean;
};

export type ChecklistItem = {
  id: string;
  label: string;
  source?: string;
  checked: boolean;
};

export type RiskFlag = {
  label: string;
  status: 'ok' | 'warning' | 'mismatch';
  note: string;
  sourceQuote?: string | null;
  userMismatch?: string | null;
  /** 소액임차인 최우선변제 전용 — 기준표 해당 여부 */
  eligibility?: '해당' | '해당없음' | null;
  /** 사용자 권리분석에 해당 항목(최우선변제·대항력 등) 관련 언급 여부 */
  userMentioned?: boolean | null;
};

export type ParsedRightsFields = {
  summary: string;
  /** 초보자용 종합 권리분석 안내 (전문가 톤) */
  expertGuide?: string;
  documentsProvided: string[];
  documentsMissing: string[];
  riskFlags: RiskFlag[];
};

export type ModelAnalysisResult = {
  model: 'claude-opus-5';
  label: string;
  summary: string;
  expertGuide?: string;
  documentsProvided?: string[];
  documentsMissing?: string[];
  riskFlags: RiskFlag[];
  latencyMs?: number;
  error?: string;
};

export type RightsAnalysisCompare = {
  claude?: ModelAnalysisResult;
  analyzedAt: string;
};

export type EvictionModelResult = {
  model: 'claude-sonnet-5';
  label: string;
  crisisFlag: boolean;
  crisisNote: string | null;
  resistLevel: 'low' | 'mid' | 'high';
  situationSummary: string;
  replyDrafts: Array<{
    tone: '차분한 톤' | '단호한 톤';
    message: string;
  }>;
  nextActions: string[];
  speakerClarity: 'clear' | 'ambiguous';
  latencyMs?: number;
  error?: string;
};

export type EvictionCoachCompare = {
  claude?: EvictionModelResult;
  analyzedAt: string;
};

export type ContentProofModelResult = {
  model: 'claude-sonnet-5';
  label: string;
  title: string;
  body: string;
  caution: string;
  latencyMs?: number;
  error?: string;
};

export type ContentProofCompare = {
  claude?: ContentProofModelResult;
  result?: ContentProofModelResult;
  analyzedAt: string;
};

/** 명도 대화 누적 기록 (사건·기기 localStorage) */
export type EvictionConversationEntry = {
  id: string;
  text: string;
  addedAt: string;
};

export type EvictionConversationLog = {
  entries: EvictionConversationEntry[];
  updatedAt: string;
};

export type LoanOffer = {
  id: string;
  name: string;
  ltv: number;
  rate: number;
  prepayRate: number;
  prepayPeriod: number;
};

export type EntryMatchInputs = {
  seedMoney: number;
  houseCount: 0 | 1 | 2 | 3;
  creditState: '우수' | '보통' | '주의';
  propType: '아파트' | '다세대' | '다가구';
  lenderType: '1금융권' | '2금융권';
  /** 물건 소재지 규제구분 (취득세용) */
  regZone?: RegZone;
  /** 수도권 여부 (LTV 6.27대책용) */
  sudogwon?: boolean;
  /** 저가주택 특례 해당 여부 */
  lowPriceException?: boolean;
  /** 처분조건부(일시적 2주택) */
  dispositionPlanned?: boolean;
  /** 생애최초 주택구입자 (무주택일 때만) */
  firstTimeBuyer?: boolean;
  /** 서민·실수요자 요건 (무주택일 때만) */
  realDemand?: boolean;
  /** 연소득 (원) — DSR 산출용 */
  annualIncome?: number;
};

export type EntryMatchResult = {
  bidCapacity: number;
  ltvApplied: number;
  dsrCapacity: number;
};

export type FieldBriefingTrade = {
  yearMonth: string;
  day: number;
  dong: string | null;
  floor: string | null;
  areaM2: number | null;
  amountMan: number;
};

export type FieldBriefingSnapshot = {
  fetchedAt: string;
  /** 캐시 무효화용 — 필드 추가 시 증가 */
  schemaVersion?: number;
  propType: '아파트' | '다세대' | '다가구';
  buildYear?: number;
  /** 사용승인일 YYYYMMDD — 표제부에 연월일이 있을 때 */
  useAprDay?: string;
  /** 공공데이터 기준 공식 단지명 */
  complexName?: string;
  /** 총괄표제부·다지번 합산 세대 수 */
  householdCount?: number;
  /** 총괄표제부·다지번 합산 동(건축물) 수 */
  buildingCount?: number;
  trades?: FieldBriefingTrade[];
  warnings?: string[];
};

/** 브리핑 조회에 필요한 최소 입력 — 사건 생성 전 미리보기에도 사용 */
export type FieldBriefingInput = {
  address?: string;
  name?: string;
  exclusiveAreaM2?: number;
  entryMatchInputs?: EntryMatchInputs;
};

export type CaseFile = {
  id: string;
  name: string;
  caseNumber: string;
  /** 매각 물건 순번 — 법원경매 maemulSer (기본 1) */
  propertyNumber?: number;
  stage: CaseStage;
  /** 입찰 준비 vs 명도 전용 — 구버전 데이터는 bidding으로 간주 */
  track: CaseTrack;
  appraisalValue: number;
  auctionDate: string;
  /** 금번 매각 회차 (유찰횟수+1) */
  auctionRound?: number;
  /** 입찰보증금율 — 보통 10%, 일부 20% */
  bidDepositRate?: 10 | 20;
  minimumSalePrice?: number;
  bidDepositAmount?: number;
  clientLabel?: string;
  /** 입찰 결과 — bidding track 전용 */
  bidOutcome?: BidOutcome;
  /** 이미 낙찰받은 사건으로 등록했을 때 할 일. 없으면 입찰 준비 경로 */
  postWinGoals?: PostWinGoals;
  /** 실제 낙찰가(원) — 낙찰 후 대출비교 기준 */
  winningBidWon?: number;
  /** 법원경매정보 법원코드 (예: B000210) */
  courtCode?: string;
  courtName?: string;
  /** 소재지 (법원경매정보) */
  address?: string;
  /** 전용면적(㎡) — 국평/대형·농특세 판정 */
  exclusiveAreaM2?: number;
  latitude?: number;
  longitude?: number;
  riskFlags: RiskFlag[];
  /** 본인이 판단한 권리분석 결과 (사건별 저장) */
  rightsJudgment?: string;
  /** 모듈 B LLM 대조 결과 (원본 문서·대화는 저장하지 않음) */
  rightsAnalysis?: RightsAnalysisCompare;
  checklist: ChecklistItem[];
  entryMatchInputs?: EntryMatchInputs;
  entryMatchResult?: EntryMatchResult;
  bidCalcInputs?: {
    sellPrice: number;
    months: number;
    loanRate: number;
    margin: number;
    /** @deprecated 개랭 비용률 — 저장 호환용, 역산에 미사용 */
    costRate?: number;
    /** 미납관리비 (만원) */
    unpaidMgmtFeeMan?: number;
    /** 명도비 (만원) */
    evictionCostMan?: number;
    /** 농어촌특별세 (만원) */
    farmTaxMan?: number;
    /** 수리비 (만원) */
    repairCostMan?: number;
    /** 강제집행비 (만원) */
    forceExecCostMan?: number;
    /** 기타비용 (만원) — 기본 30 */
    miscOtherCostMan?: number;
    /** 공시가격·시가표준액 (원) — 국민주택채권 계산 */
    officialPrice?: number;
    /** auto | standard | large — 전용면적 기준 자동 또는 수동 */
    propertySizeMode?: 'auto' | 'standard' | 'large';
    /** 입찰가 화면 전용면적 (사건 값과 동기화) */
    exclusiveAreaM2?: number;
    /** 건물분 부가세 — direct: 금액 직접, standards: 기준시가 산출 */
    buildingVatCalcMode?: 'direct' | 'standards';
    /** 건물분 부가세 (원) — direct 모드 */
    buildingVatWon?: number;
    /** @deprecated buildingVatWon 사용. 구버전 만원 저장값 */
    buildingVatMan?: number;
    landAreaM2?: number;
    landUnitPricePerM2?: number;
    buildingStandardPrice?: number;
    /** 제4장 역산 입찰가(원) — 제5장 대출비교가 이 값을 그대로 사용 */
    bidPrice?: number;
    /** 제4장 실질 매도가(원) */
    effectiveSellPrice?: number;
    /** 제4장 이자·중도상환 제외 상세비용(원) */
    financeFreeDetailed?: number;
    /** 국민주택채권 본인부담(원) */
    housingBondBurden?: number;
  };
  loanOffers?: LoanOffer[];
  /** 모듈 E LLM 결과 */
  evictionCoach?: EvictionCoachCompare;
  /** 명도 대화 원문 누적 (사건별 localStorage) */
  evictionConversationLog?: EvictionConversationLog;
  evictionSummary?: {
    resistLevel: 'low' | 'mid' | 'high';
    nextActions: string[];
  };
  /** 내용증명 초안 (LLM) */
  contentProof?: ContentProofCompare;
  /** 임장 브리핑 (연식·실거래) */
  fieldBriefing?: FieldBriefingSnapshot;
};

export type CreateCaseInput = {
  name: string;
  track?: CaseTrack;
  caseNumber?: string;
  propertyNumber?: number;
  courtCode?: string;
  courtName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  appraisalValue?: number;
  auctionDate?: string;
  auctionRound?: number;
  bidDepositRate?: 10 | 20;
  minimumSalePrice?: number;
  bidDepositAmount?: number;
  clientLabel?: string;
  exclusiveAreaM2?: number;
  fieldBriefing?: FieldBriefingSnapshot;
  stage?: CaseStage;
  bidOutcome?: BidOutcome;
  postWinGoals?: PostWinGoals;
  winningBidWon?: number;
  bidCalcInputs?: CaseFile['bidCalcInputs'];
};
