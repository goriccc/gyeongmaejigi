import {
  RIGHTS_SYSTEM_PROMPT,
  buildRightsUserPrompt,
  parseRightsAnalysisJson,
  type ParsedRightsAnalysis,
  type RightsLlmPayload,
} from './rightsPrompt';
import { fetchWithTimeout, LLM_TIMEOUT_MS } from './fetchTimeout';

const DEEPSEEK_MODEL = 'deepseek-v4-pro';

export async function analyzeWithDeepSeek(
  payload: RightsLlmPayload,
): Promise<ParsedRightsAnalysis> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY가 설정되지 않았습니다.');
  }

  const textPayload: RightsLlmPayload = {
    ...payload,
    pdfs: undefined,
    documentText:
      payload.documentText.trim() ||
      '(PDF 텍스트 추출 결과가 비어 있습니다. 스캔본일 수 있으니 문서 미제공·확인 불가로 처리하세요.)',
  };

  const res = await fetchWithTimeout(
    'https://api.deepseek.com/chat/completions',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.2,
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
        stream: false,
        messages: [
          { role: 'system', content: RIGHTS_SYSTEM_PROMPT },
          { role: 'user', content: buildRightsUserPrompt(textPayload) },
        ],
      }),
    },
    LLM_TIMEOUT_MS,
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `DeepSeek API 오류 (${res.status}): ${errText.slice(0, 280) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('DeepSeek 응답에 content가 없습니다.');
  }

  return parseRightsAnalysisJson(text, payload.judgment);
}

export { DEEPSEEK_MODEL };
