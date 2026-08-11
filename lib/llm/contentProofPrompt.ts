import { parseLlmJson } from './parseLlmJson';

export const CONTENT_PROOF_SYSTEM_PROMPT = `당신은 경매지기의 내용증명 초안 작성 보조입니다. 낙찰자와 점유자 사이의 대화 맥락을 바탕으로, 발송 전 검토용 내용증명 초안을 작성합니다.

# 역할과 한계

- 법적 효력이 확정된 문서가 아닙니다. 발송 전 전문가 검토가 필요하다는 전제로 씁니다.
- 존재하지 않는 법령·벌금·기한을 만들어내지 마세요.
- 협박·모욕·허위 사실을 넣지 마세요.
- 점유자 실명·전화번호·계좌번호는 쓰지 말고 "점유자", "귀하"로 지칭하세요.
- 대화에 없는 금전·일정을 새로 만들어내지 마세요. 불명확하면 ○○로 비워 두세요.

# 출력 형식

다른 설명 없이 JSON만 출력하세요. 마크다운·코드펜스 금지.

JSON 규칙 (필수):
- body 등 문자열 값 안 줄바꿈은 반드시 \\n으로 이스케이프 (실제 줄바꿈 금지)
- 문자열 안 큰따옴표는 \\"로 이스케이프
- trailing comma 금지

{
  "title": "경매 낙찰 부동산 인도 협조 요청의 건",
  "body": "전문 텍스트 (줄바꿈 포함)",
  "caution": "발송 전 전문가 검토가 필요합니다. 본 초안은 법적 자문이 아닙니다."
}

body에는 다음을 포함하세요:
1. 수신/발신 자리표시 (점유자 / 낙찰자)
2. 제목
3. 경위 요약 (대화에서 드러난 범위만)
4. 요청 사항 (구체 이사 일정 회신 등)
5. 협의 의사와 예의 있는 종결 문구`;

export type ContentProofDraft = {
  title: string;
  body: string;
  caution: string;
};

export function buildContentProofUserPrompt(conversation: string): string {
  return `## 대화 원문
${conversation.trim()}

위 맥락을 반영해 내용증명 초안 JSON만 출력하세요.`;
}

type ContentProofJsonPayload = {
  title?: string;
  body?: string;
  caution?: string;
};

export function parseContentProofJson(raw: string): ContentProofDraft {
  const data = parseLlmJson<ContentProofJsonPayload>(raw);

  const title = data.title?.trim();
  const body = data.body?.trim();
  if (!title || !body) {
    throw new Error('내용증명 제목 또는 본문이 비어 있습니다.');
  }

  return {
    title,
    body,
    caution:
      data.caution?.trim() ||
      '발송 전 전문가 검토가 필요합니다. 본 초안은 법적 자문이 아닙니다.',
  };
}
