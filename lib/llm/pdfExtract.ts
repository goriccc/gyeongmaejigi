import { extractText, getDocumentProxy } from 'unpdf';

const MAX_PDF_BYTES = 28 * 1024 * 1024; // Claude ~32MB 여유

export async function fileToBase64(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString('base64');
}

/**
 * PDF에서 텍스트를 추출합니다. (문서 본문 합침·검색용)
 * 스캔본(이미지 PDF)은 텍스트가 거의 없을 수 있습니다.
 */
export async function extractPdfText(
  file: File,
): Promise<{ text: string; pageCount: number }> {
  const data = new Uint8Array(await file.arrayBuffer());
  if (data.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `${file.name}: PDF가 너무 큽니다 (최대 약 28MB).`,
    );
  }
  const pdf = await getDocumentProxy(data);
  const result = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(result.text)
    ? result.text.join('\n')
    : String(result.text ?? '');
  return {
    text: text.trim(),
    pageCount: result.totalPages ?? 0,
  };
}

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}

export { MAX_PDF_BYTES };
