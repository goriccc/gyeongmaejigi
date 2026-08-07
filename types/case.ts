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
  checklist: ChecklistItem[];
  entryMatchInputs?: {
    seedMoney: number;
    houseCount: 0 | 1 | 2;
    creditState: '우수' | '보통' | '주의';
    propType: '아파트' | '다세대' | '다가구';
    lenderType: '1금융권' | '2금융권';
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
