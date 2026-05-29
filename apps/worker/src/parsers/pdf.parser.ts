import { extractText, getDocumentProxy, getMeta } from 'unpdf';

import { PermanentError } from '../lib/retry.js';

import type { FileParser, ParseResult } from './types.js';

/**
 * Parse PDF -> plain text + page count + author info.
 *
 * Dung `unpdf` (modern pdfjs-dist serverless build). pdf-parse classic dung
 * pdfjs 1.10.x rat cu, fail tren PDF gen tu pdf-lib / nhieu nguon hien dai.
 *
 * Behavior:
 * - Empty text => warning "no extractable text, may need OCR" (KHONG fail,
 *   de Phase OCR sau xu ly).
 * - PDF corrupt => PermanentError.
 */
export const pdfParser: FileParser = {
  name: 'pdf',
  supports(mimeType, filename) {
    if (mimeType === 'application/pdf') return true;
    return filename.toLowerCase().endsWith('.pdf');
  },
  async parse(buffer: Buffer): Promise<ParseResult> {
    let proxy;
    let textResult;
    let meta;
    try {
      // getDocumentProxy chap nhan Uint8Array; Buffer la subclass nen pass duoc.
      proxy = await getDocumentProxy(new Uint8Array(buffer));
      textResult = await extractText(proxy, { mergePages: true });
      meta = await getMeta(proxy);
    } catch (err) {
      throw new PermanentError(
        `Failed to parse PDF: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    const text = Array.isArray(textResult.text)
      ? textResult.text.join('\n').trim()
      : String(textResult.text).trim();
    const warnings: string[] = [];
    if (text.length === 0) {
      warnings.push('no extractable text, may need OCR');
    }

    return {
      text,
      metadata: {
        pageCount: proxy.numPages,
        info: meta.info,
        metadata: meta.metadata,
      },
      warnings,
    };
  },
};
