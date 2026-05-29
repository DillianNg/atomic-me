import Anthropic from '@anthropic-ai/sdk';

import { env } from '../config/env.js';

/**
 * Singleton Anthropic client cho worker.
 * - timeout: 60s. Extraction call thuong < 20s, 60s la headroom.
 * - maxRetries: 2. SDK tu retry transient (429, 5xx, network). Worker level
 *   retry van con qua BullMQ (3 attempts), tong cong 3 * 3 = 9 lan trong worst case.
 *   Chap nhan vi extract job dat dat nhe.
 *
 * KHONG cache response. Moi job extract isolated.
 */
export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  timeout: 60_000,
  maxRetries: 2,
});
