import type { CaseFile, ChecklistItem } from '@/types/case';
import { buildChecklist } from '@/lib/checklist';

function propTypeRules(c: CaseFile): ChecklistItem[] {
  const propType = c.entryMatchInputs?.propType;
  const items: ChecklistItem[] = [];

  if (propType === '다가구') {
    items.push(
      {
        id: 'prop-dagagu-units',
        label: '층별 세대 수·외부 계량기·현관 구조 확인',
        source: '물건유형 · 다가구',
        checked: false,
      },
      {
        id: 'prop-dagagu-parking',
        label: '골목 폭·주차 가능 여부 확인',
        source: '물건유형 · 다가구',
        checked: false,
      },
    );
  }

  if (propType === '다세대') {
    items.push(
      {
        id: 'prop-dasegae-common',
        label: '공용부(복도·계단·옥탑) 상태 확인',
        source: '물건유형 · 다세대',
        checked: false,
      },
      {
        id: 'prop-dasegae-units',
        label: '층별 세대 분리·소음 전달 여부 확인',
        source: '물건유형 · 다세대',
        checked: false,
      },
    );
  }

  if (propType === '아파트') {
    items.push(
      {
        id: 'prop-apt-mgmt',
        label: '관리사무소·동·라인·주차장 위치 확인',
        source: '물건유형 · 아파트',
        checked: false,
      },
      {
        id: 'prop-apt-view',
        label: '조망·일조·전면 도로 소음 확인',
        source: '물건유형 · 아파트',
        checked: false,
      },
    );
  }

  return items;
}

function addressContextRules(c: CaseFile): ChecklistItem[] {
  const addr = (c.address ?? '').trim();
  if (!addr) return [];

  const items: ChecklistItem[] = [];

  if (/역\s*\d*\s*m|역세권|역\s*인근|역\s*앞|역\s*근처/.test(addr)) {
    items.push(
      {
        id: 'ctx-station-noise',
        label: '역세권 — 유동인구·소음·야간 조명 확인',
        source: '소재지 · 역세권 추정',
        checked: false,
      },
      {
        id: 'ctx-station-parking',
        label: '역세권 — 주변 주차·공유킥보드 혼잡 확인',
        source: '소재지 · 역세권 추정',
        checked: false,
      },
    );
  }

  if (/산\s*\d+|고개|언덕|경사|해발/.test(addr)) {
    items.push({
      id: 'ctx-slope',
      label: '경사 구간 — 주차·배수·겨울 결빙·보행 접근성 확인',
      source: '소재지 · 경사 추정',
      checked: false,
    });
  }

  if (/리\s|\d+리\s|면\s|읍\s/.test(addr) && !/구\s|동\s/.test(addr)) {
    items.push({
      id: 'ctx-rural-access',
      label: '외곽·읍면 — 대중교통·마트·생활편의 접근성 확인',
      source: '소재지 · 외곽 추정',
      checked: false,
    });
  }

  return items;
}

function auctionRules(c: CaseFile): ChecklistItem[] {
  const round = c.auctionRound ?? 1;
  if (round < 2) return [];

  return [
    {
      id: 'auction-round-mood',
      label: `${round}회차 — 유찰 흔적·현장 분위기·관심도 확인`,
      source: '매각 회차',
      checked: false,
    },
  ];
}

/**
 * 규칙 기반 물건별 임장 체크포인트 (LLM 없음).
 */
export function buildFieldChecklist(c: CaseFile): ChecklistItem[] {
  const base = buildChecklist(c.riskFlags, c.checklist);
  const extras = [
    ...propTypeRules(c),
    ...addressContextRules(c),
    ...auctionRules(c),
  ];

  const byId = new Map<string, ChecklistItem>();
  for (const item of [...extras, ...base]) {
    const prev = byId.get(item.id);
    if (prev) {
      byId.set(item.id, { ...item, checked: prev.checked });
    } else {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()];
}
