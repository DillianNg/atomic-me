import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { extractAtomsFromAsset } from '../../src/ai/extraction.js';

/**
 * Real Anthropic e2e (Phase 7.9 smoke).
 *
 * Bo qua mac dinh:
 *  - Khi SKIP_E2E khac '0' / 'false' (mac dinh = '1' trong CI / vitest env).
 *  - Khi ANTHROPIC_API_KEY rong hoac la 'sk-ant-test-dummy' (fake env).
 *
 * Chay cuc bo:
 *   SKIP_E2E=0 ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @atomic-me/worker test:e2e
 */

const SKIP = (() => {
  const raw = process.env['SKIP_E2E'];
  if (raw === undefined) return true;
  return raw !== '0' && raw.toLowerCase() !== 'false';
})();
const HAS_KEY = Boolean(
  process.env['ANTHROPIC_API_KEY'] &&
    process.env['ANTHROPIC_API_KEY'] !== 'sk-ant-test-dummy',
);

const describeMaybe = SKIP || !HAS_KEY ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARSED_TEXT = readFileSync(
  join(__dirname, '..', 'fixtures', 'cvs', 'smoke-cv.parsed.txt'),
  'utf-8',
);

describeMaybe('extract-atoms e2e (real Anthropic call)', () => {
  it('extracts atoms with byte-exact evidence + reasonable cost', async () => {
    const log = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
      fatal: () => undefined,
      trace: () => undefined,
      child() {
        return this;
      },
    } as unknown as import('pino').Logger;

    const result = await extractAtomsFromAsset({
      assetId: 'asset_e2e_1',
      userId: 'user_e2e_1',
      parsedText: PARSED_TEXT,
      sourceType: 'cv',
      language: 'en',
      log,
    });

    expect(result.atoms.length).toBeGreaterThanOrEqual(3);
    expect(result.sourceLanguage).toBe('en');
    expect(result.totalCostUsd).toBeLessThan(0.15);

    // Every atom snippet must be byte-exact in parsedText.
    for (const atom of result.atoms) {
      const slice = PARSED_TEXT.slice(
        atom.evidenceSpan.startOffset,
        atom.evidenceSpan.endOffset,
      );
      expect(slice).toBe(atom.evidenceSpan.snippet);
    }

    // We expect Python skill to be found in the smoke fixture.
    const skills = result.atoms.filter((a) => a.kind === 'SKILL');
    const skillNames = skills.map((s) => {
      const content = s.content as { name?: string };
      return content.name ?? '';
    });
    expect(skillNames.some((n) => /python/i.test(n))).toBe(true);
  }, 90_000);
});
