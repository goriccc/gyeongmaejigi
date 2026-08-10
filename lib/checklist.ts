import type { ChecklistItem, RiskFlag } from '@/types/case';

/** 물건 무관 공통 임장 체크리스트 */
export const COMMON_CHECKLIST: Omit<ChecklistItem, 'id'>[] = [
  {
    label: '위치·접근성·생활권 육안 확인',
    checked: false,
  },
  {
    label: '주변 동시기 실거래가 3건 이상 비교 확인',
    checked: false,
  },
  {
    label: '일조·소음·주차 여건 육안 확인',
    checked: false,
  },
];

/**
 * 리스크 플래그로부터 물건별 체크리스트 항목을 생성합니다.
 */
export function checklistFromRiskFlags(flags: RiskFlag[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  for (const flag of flags) {
    if (flag.status !== 'warning' && flag.status !== 'mismatch') continue;

    if (flag.label.includes('대항력')) {
      items.push(
        {
          id: `risk-daehang-office-${flag.label}`,
          label: '관리사무소 방문해 실거주자·세대원수 확인',
          source: `제2장 · "${flag.label}" 항목에서 생성됨`,
          checked: false,
        },
        {
          id: `risk-daehang-mail-${flag.label}`,
          label: '우편함·전입 흔적 육안 확인',
          source: flag.note.includes('폐문')
            ? '제2장 · "폐문부재" 항목에서 생성됨'
            : `제2장 · "${flag.label}" 항목에서 생성됨`,
          checked: false,
        },
      );
      continue;
    }

    items.push({
      id: `risk-${flag.label}`,
      label: `${flag.label} 현장 재확인`,
      source: `제2장 · "${flag.label}" 항목에서 생성됨`,
      checked: false,
    });
  }

  return items;
}

/**
 * 공통 항목 + 리스크 파생 항목을 합칩니다. (id 기준 중복 제거)
 */
export function buildChecklist(
  flags: RiskFlag[],
  existing?: ChecklistItem[],
): ChecklistItem[] {
  const derived = checklistFromRiskFlags(flags);
  const common: ChecklistItem[] = COMMON_CHECKLIST.map((c, i) => {
    const prev = existing?.find((e) => e.id === `common-${i}`);
    return {
      id: `common-${i}`,
      label: c.label,
      checked: prev?.checked ?? false,
      source: c.source,
    };
  });

  const merged = [...derived, ...common];
  return merged.map((item) => {
    const prev = existing?.find((e) => e.id === item.id);
    return prev ? { ...item, checked: prev.checked } : item;
  });
}

/** 개발·테스트용 샘플 플래그 */
export const MOCK_RISK_FLAGS: RiskFlag[] = [
  {
    label: '대항력 있는 임차인 여부',
    status: 'warning',
    note: '현황조사서상 폐문부재로 전입일자 확인이 필요할 수 있습니다.',
    sourceQuote: null,
    userMismatch: null,
  },
  {
    label: '말소기준권리',
    status: 'ok',
    note: '근저당권이 말소기준권리로 보이는지 확인이 필요합니다.',
    sourceQuote: null,
    userMismatch: null,
  },
];
