import sharp from 'sharp';

import { PermanentError } from '../lib/retry.js';

import type { FileParser, ParseResult } from './types.js';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Phase 6: chua extract text tu image (Claude vision o Phase 7).
 * Parser chi validate image hop le qua sharp metadata. Return text rong +
 * warning de pipeline biet defer sang Phase sau.
 */
export const imageParser: FileParser = {
  name: 'image',
  supports(mimeType, filename) {
    if (IMAGE_MIMES.has(mimeType)) return true;
    return /\.(png|jpg|jpeg|webp)$/i.test(filename);
  },
  async parse(buffer: Buffer): Promise<ParseResult> {
    try {
      const meta = await sharp(buffer).metadata();
      return {
        text: '',
        metadata: {
          width: meta.width ?? null,
          height: meta.height ?? null,
          format: meta.format ?? null,
          sizeBytes: buffer.length,
        },
        warnings: ['image parsing deferred to extraction phase'],
      };
    } catch (err) {
      throw new PermanentError(
        `Failed to parse image: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  },
};
