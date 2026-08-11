import type { RegZone } from '@/lib/calc/acquisitionTax';

export type CaseStage = 'A' | 'B' | 'C' | 'D' | 'F' | 'E' | 'done';

/** 입찰 준비(A~D) vs 명도 전용(E) */
export type CaseTrack = 'bidding' | 'eviction';

export type BidOutcome = 'pending' | 'won' | 'lost' | 'skipped';

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
};

export type EntryMatchResult = {
  bidCapacity: number;
  ltvApplied: number;
  dsrCapacity: number;
};

export type CaseFile = {
  id: string;
  name: string;
  caseNumber: string;
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
  /** 법원경매정보 법원코드 (예: B000210) */
  courtCode?: string;
  courtName?: string;
  /** 소재지 (법원경매정보) */
  address?: string;
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
    costRate: number;
    /** 미납관리비 (만원) */
    unpaidMgmtFeeMan?: number;
    /** 농어촌특별세 (만원) */
    farmTaxMan?: number;
    /** 수리비 (만원) */
    repairCostMan?: number;
    /** 강제집행비 (만원) */
    forceExecCostMan?: number;
    /** 공시가격·시가표준액 (원) — 국민주택채권 계산 */
    officialPrice?: number;
  };
  loanOffers?: LoanOffer[];
  /** 모듈 E LLM 결과 요약 (대화 원문은 저장하지 않음) */
  evictionCoach?: EvictionCoachCompare;
  evictionSummary?: {
    resistLevel: 'low' | 'mid' | 'high';
    nextActions: string[];
  };
};

export type CreateCaseInput = {
  name: string;
  track?: CaseTrack;
  caseNumber?: string;
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
};
