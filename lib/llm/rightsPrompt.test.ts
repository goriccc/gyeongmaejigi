import { describe, expect, it } from 'vitest';
import {
  noteSaysCollectiveLandClear,
  parseRightsAnalysisJson,
} from './rightsPrompt';

const MOKDONG_NOTE =
  "건물 등기부 대지권 표시란에 '별도등기 있음 1토지(을구 7번 근저당권 설정 등기)'가 있으나 말소선이 그어져 있고, 3번에 '2번 별도등기 말소 2016년9월12일 등기'가 기재되어 있습니다. 따라서 현재는 소멸한 것으로 보입니다. 지상권·구분지상권·지역권 기재는 확인되지 않습니다. 다만 토지등기가 제공되지 않아 대지(목동 324-80)의 현재 권리 상태는 확인할 수 없습니다. 토지등기 열람으로 말소와 신규 설정 여부를 확인해야 합니다.";

function landFlag(note: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    riskFlags: [
      {
        label: '토지별도등기(지상권)',
        status: 'warning',
        note,
        userMentioned: false,
        ...extra,
      },
    ],
  });
}

describe('noteSaysCollectiveLandClear', () => {
  it('대지권 별도등기 말소 + 지상권 기재 없음이면 true', () => {
    expect(noteSaysCollectiveLandClear(MOKDONG_NOTE)).toBe(true);
  });

  it('대지권 별도등기가 말소되지 않았으면 false', () => {
    expect(
      noteSaysCollectiveLandClear(
        "대지권 표시란에 '별도등기 있음 1토지(을구 7번 근저당권)'이 기재되어 있습니다.",
      ),
    ).toBe(false);
  });

  it('집합건물 근거가 없으면 false', () => {
    expect(
      noteSaysCollectiveLandClear('별도등기는 말소되었습니다. 토지등기 확인 필요.'),
    ).toBe(false);
  });

  it('지상권 설정 기재가 있으면 false', () => {
    expect(
      noteSaysCollectiveLandClear(
        '다세대 대지권 별도등기는 말소됨. 다만 토지에 지상권 설정 등기가 있습니다.',
      ),
    ).toBe(false);
  });
});

describe('parseRightsAnalysisJson — 집합건물 토지별도등기', () => {
  it('사용자 미언급이면 warning → ok', () => {
    const r = parseRightsAnalysisJson(landFlag(MOKDONG_NOTE), '');
    expect(r.riskFlags[0].status).toBe('ok');
    expect(r.riskFlags[0].note).toContain('집합건물');
  });

  it('사용자가 별도등기를 언급했으면 보정하지 않음', () => {
    const r = parseRightsAnalysisJson(
      landFlag(MOKDONG_NOTE),
      '대지권 별도등기가 걱정됩니다.',
    );
    expect(r.riskFlags[0].status).toBe('warning');
  });
});
