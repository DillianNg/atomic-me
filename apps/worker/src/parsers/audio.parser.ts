import { PermanentError } from '../lib/retry.js';

import type { FileParser, ParseResult } from './types.js';

const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/wav', 'audio/mp4']);

/**
 * Phase 6: chua ho tro audio. Khi worker pick mot job audio, parse() throw
 * PermanentError de status -> FAILED, khong retry.
 * TODO Phase 8+: tich hop Whisper / Anthropic Files API.
 */
export const audioParser: FileParser = {
  name: 'audio',
  supports(mimeType, filename) {
    if (AUDIO_MIMES.has(mimeType)) return true;
    return /\.(mp3|wav|m4a)$/i.test(filename);
  },
  async parse(): Promise<ParseResult> {
    throw new PermanentError('Audio parsing not yet supported');
  },
};
