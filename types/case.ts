export type CaseStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'done';

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
  documentsProvided: string[];
  documentsMissing: string[];
  riskFlags: RiskFlag[];
};

export type ModelAnalysisResult = {
  model: 'claude-opus-5' | 'deepseek-v4-pro';
  label: string;
  summary: string;
  documentsProvided?: string[];
  documentsMissing?: string[];
  riskFlags: RiskFlag[];
  latencyMs?: number;
  error?: string;
};

export type RightsAnalysisCompare = {
  claude?: ModelAnalysisResult;
  deepseek?: ModelAnalysisResult;
  analyzedAt: string;
};

export type EvictionModelResult = {
  model: 'claude-opus-5' | 'deepseek-v4-pro';
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
  deepseek?: EvictionModelResult;
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

export type CaseFile = {
  id: string;
  name: string;
  caseNumber: string;
  stage: CaseStage;
  appraisalValue: number;
  auctionDate: string;
  riskFlags: RiskFlag[];
  /** 모듈 B 이중 LLM 대조 결과 (원본 문서·대화는 저장하지 않음) */
  rightsAnalysis?: RightsAnalysisCompare;
  checklist: ChecklistItem[];
  entryMatchInputs?: {
    seedMoney: number;
    houseCount: 0 | 1 | 2 | 3;
    creditState: '우수' | '보통' | '주의';
    propType: '아파트' | '다세대' | '다가구';
    lenderType: '1금융권' | '2금융권';
    /** 물건 소재지 규제구분 (취득세용) */
    regZone?: 'none' | 'adjusted' | 'overheated';
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
  entryMatchResult?: {
    bidCapacity: number;
    ltvApplied: number;
    dsrCapacity: number;
  };
  bidCalcInputs?: {
    sellPrice: number;
    months: number;
    loanRate: number;
    margin: number;
    costRate: number;
  };
  loanOffers?: LoanOffer[];
  /** 모듈 E 이중 LLM 결과 요약 (대화 원문은 저장하지 않음) */
  evictionCoach?: EvictionCoachCompare;
  evictionSummary?: {
    resistLevel: 'low' | 'mid' | 'high';
    nextActions: string[];
  };
};

export type CreateCaseInput = {
  name: string;
  caseNumber: string;
  appraisalValue: number;
  auctionDate: string;
};
