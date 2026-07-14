/** 根拠: REQ-037 / PrjOps:SPEC-INT-063 / ADR-0008。Excel取込のweb側サイズ上限。 */
export const XLSX_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export async function readXlsxBody(request: Request): Promise<Uint8Array<ArrayBuffer> | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > XLSX_IMPORT_MAX_BYTES) return null;
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > XLSX_IMPORT_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
