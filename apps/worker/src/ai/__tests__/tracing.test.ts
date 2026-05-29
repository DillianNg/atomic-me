import type { Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { isLangfuseConfigured, traced } from '../tracing.js';

function makeLog(): Logger {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child() {
      return log;
    },
  };
  return log as unknown as Logger;
}

const ctx = {
  name: 'extract-atoms.chunk',
  promptVersion: 'extract-atom@v1.0.0',
  model: 'claude-haiku-4-5',
  userId: 'user_1',
  assetId: 'asset_1',
  chunkIndex: 0,
};

describe('traced', () => {
  it('logs llm.call with cost + latency on success', async () => {
    const log = makeLog();
    const result = await traced(ctx, log, async () => ({
      data: { atoms: [] },
      usage: { inputTokens: 1000, outputTokens: 500 },
    }));
    expect(result.usage.inputTokens).toBe(1000);
    expect(result.usage.outputTokens).toBe(500);
    // Haiku 4.5: ($1 in + $5 out) per M -> 1000 * 1e-6 + 500 * 5e-6 = 0.001 + 0.0025 = 0.0035
    expect(result.costUsd).toBeCloseTo(0.0035, 6);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    const infoCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls;
    expect(infoCalls.length).toBe(1);
    const logFields = infoCalls[0]?.[0] as Record<string, unknown>;
    expect(logFields['span']).toBe('extract-atoms.chunk');
    expect(logFields['promptVersion']).toBe('extract-atom@v1.0.0');
    expect(logFields['costUsd']).toBeCloseTo(0.0035, 6);
  });

  it('logs llm.call.failed + rethrows on error', async () => {
    const log = makeLog();
    const err = new Error('rate limit');
    await expect(
      traced(ctx, log, async () => {
        throw err;
      }),
    ).rejects.toBe(err);

    const errorCalls = (log.error as ReturnType<typeof vi.fn>).mock.calls;
    expect(errorCalls.length).toBe(1);
    const fields = errorCalls[0]?.[0] as Record<string, unknown>;
    expect(fields['span']).toBe('extract-atoms.chunk');
    expect(fields['err']).toBe(err);
  });

  it('returns 0 cost for unknown model (no throw)', async () => {
    const log = makeLog();
    const result = await traced(
      { ...ctx, model: 'claude-future-9000' },
      log,
      async () => ({ data: null, usage: { inputTokens: 100, outputTokens: 200 } }),
    );
    expect(result.costUsd).toBe(0);
  });

  it('isLangfuseConfigured returns false when env keys empty', () => {
    expect(isLangfuseConfigured()).toBe(false);
  });
});
