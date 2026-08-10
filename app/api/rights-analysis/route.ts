import { analyzeWithClaude, CLAUDE_MODEL } from '@/lib/llm/claude';
import {
  extractPdfText,
  fileToBase64,
  isPdfFile,
  MAX_PDF_BYTES,
} from '@/lib/llm/pdfExtract';
import type { PdfAttachment, RightsLlmPayload } from '@/lib/llm/rightsPrompt';
import type { ModelAnalysisResult, ParsedRightsFields } from '@/types/case';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function runOne(
  fn: () => Promise<ParsedRightsFields>,
): Promise<ModelAnalysisResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return {
      model: CLAUDE_MODEL,
      label: 'AI 권리분석',
      summary: result.summary,
      documentsProvided: result.documentsProvided,
      documentsMissing: result.documentsMissing,
      riskFlags: result.riskFlags,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      model: CLAUDE_MODEL,
      label: 'AI 권리분석',
      summary: '',
      documentsProvided: [],
      documentsMissing: [],
      riskFlags: [],
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : '알 수 없는 오류',
    };
  }
}

function ndjsonLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response(
      JSON.stringify({
        type: 'error',
        error: 'multipart/form-data 요청이 필요합니다.',
      }) + '\n',
      {
        status: 400,
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
      },
    );
  }

  const judgment = String(form.get('judgment') ?? '').trim();
  let documentText = String(form.get('documentText') ?? '').trim();
  const fileEntries = form
    .getAll('files')
    .filter((v): v is File => v instanceof File);

  if (!judgment && !documentText && fileEntries.length === 0) {
    return new Response(
      JSON.stringify({
        type: 'error',
        error: '본인 판단 또는 첨부 파일 중 하나 이상을 입력해 주세요.',
      }) + '\n',
      {
        status: 400,
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
      },
    );
  }

  const fileNames = fileEntries.map((f) => f.name).slice(0, 10);
  const pdfs: PdfAttachment[] = [];
  const extractedChunks: string[] = [];

  for (const file of fileEntries.slice(0, 5)) {
    if (!isPdfFile(file)) {
      if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
        const t = await file.text();
        extractedChunks.push(`### ${file.name}\n${t.slice(0, 40_000)}`);
      }
      continue;
    }

    if (file.size > MAX_PDF_BYTES) {
      return new Response(
        JSON.stringify({
          type: 'error',
          error: `${file.name}: PDF는 약 28MB 이하여야 합니다.`,
        }) + '\n',
        {
          status: 400,
          headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
        },
      );
    }

    const base64 = await fileToBase64(file);
    pdfs.push({
      name: file.name,
      mimeType: 'application/pdf',
      base64,
    });

    try {
      const { text, pageCount } = await extractPdfText(file);
      if (text) {
        extractedChunks.push(
          `### ${file.name} (PDF 텍스트 추출, ${pageCount}p)\n${text.slice(0, 60_000)}`,
        );
      } else {
        extractedChunks.push(
          `### ${file.name}\n(텍스트 추출 결과 없음 — 스캔본일 가능성이 있습니다)`,
        );
      }
    } catch (err) {
      extractedChunks.push(
        `### ${file.name}\n(텍스트 추출 실패: ${err instanceof Error ? err.message : '오류'})`,
      );
    }
  }

  if (extractedChunks.length) {
    documentText = [documentText, ...extractedChunks]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 120_000);
  }

  const payload: RightsLlmPayload = {
    judgment,
    fileNames,
    documentText,
    pdfs,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(ndjsonLine(obj));
      };

      try {
        const result = await runOne(() => analyzeWithClaude(payload));
        send({ type: 'result', result });
        send({ type: 'done', analyzedAt: new Date().toISOString() });
      } catch (err) {
        send({
          type: 'error',
          error:
            err instanceof Error
              ? err.message
              : '권리분석 중 서버 오류가 발생했습니다.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
