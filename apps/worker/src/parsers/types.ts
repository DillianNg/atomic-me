/**
 * Interface chung cua moi file parser trong worker.
 * Tach khoi index.ts de tranh import vong (registry + tung parser cung import).
 */

/** Ket qua parse 1 file. */
export interface ParseResult {
  /** Plain text trich xuat duoc (PDF/DOCX/csv...). Co the rong (vd image, scan-PDF). */
  text: string;
  /** Metadata parser-specific (page count, language, dimensions, counts,...). */
  metadata: Record<string, unknown>;
  /** Canh bao khong fatal (vd 'no extractable text'). */
  warnings: string[];
}

/** Mot parser xu ly mot loai file. */
export interface FileParser {
  /** Ten parser de log/debug ('pdf', 'docx', 'linkedin-archive', ...). */
  readonly name: string;
  /** Goi worker khi can parse. Throw PermanentError neu file invalid. */
  parse(buffer: Buffer, filename: string): Promise<ParseResult>;
  /** Routing: tra true neu parser nay handle duoc (mime, ten file). */
  supports(mimeType: string, filename: string): boolean;
}
