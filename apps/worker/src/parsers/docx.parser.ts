import mammoth from 'mammoth';

import { PermanentError } from '../lib/retry.js';

import type { FileParser, ParseResult } from './types.js';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Parse DOCX -> raw text (mat formatting, giu paragraph break).
 * mammoth tra them messages (vd "Unrecognized style: foo"); copy len warnings.
 */
export const docxParser: FileParser = {
  name: 'docx',
  supports(mimeType, filename) {
    if (mimeType === DOCX_MIME) return true;
    return filename.toLowerCase().endsWith('.docx');
  },
  async parse(buffer: Buffer): Promise<ParseResult> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const warnings = result.messages.map((m) => `${m.type}: ${m.message}`);
      return {
        text: result.value.trim(),
        metadata: { messageCount: result.messages.length },
        warnings,
      };
    } catch (err) {
      throw new PermanentError(
        `Failed to parse DOCX: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  },
};
