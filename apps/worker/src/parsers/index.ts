import { PermanentError } from '../lib/retry.js';

import { audioParser } from './audio.parser.js';
import { docxParser } from './docx.parser.js';
import { imageParser } from './image.parser.js';
import { linkedinArchiveParser } from './linkedin-archive.parser.js';
import { pdfParser } from './pdf.parser.js';
import type { FileParser } from './types.js';

/**
 * Thu tu trong mang QUAN TRONG: parser cu the (LinkedIn zip) phai check
 * truoc parser tong quat (image, audio, docx, pdf). Khi `application/zip`
 * di vao, LinkedIn parser nhan dien bang filename / noi dung.
 */
const PARSERS: readonly FileParser[] = [
  linkedinArchiveParser,
  pdfParser,
  docxParser,
  imageParser,
  audioParser,
];

export interface ParserRegistry {
  /** Tra parser dau tien `supports(mime, name)` = true; throw PermanentError neu khong co. */
  getParser(mimeType: string, filename: string): FileParser;
}

export const parserRegistry: ParserRegistry = {
  getParser(mimeType, filename) {
    const parser = PARSERS.find((p) => p.supports(mimeType, filename));
    if (!parser) {
      throw new PermanentError(
        `Unsupported file type: mime=${mimeType}, filename=${filename}`,
      );
    }
    return parser;
  },
};

export { pdfParser, docxParser, imageParser, audioParser, linkedinArchiveParser };
export type { FileParser, ParseResult } from './types.js';
