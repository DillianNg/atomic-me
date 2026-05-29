import { describe, expect, it, vi } from 'vitest';

import { PermanentError, TransientError, withRetry } from '../retry.js';

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { retries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on TransientError up to the limit', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new TransientError('flaky');
        return 'eventual';
      },
      { retries: 3, baseDelayMs: 1 },
    );
    expect(result).toBe('eventual');
    expect(calls).toBe(3);
  });

  it('does NOT retry on PermanentError', async () => {
    const fn = vi.fn().mockRejectedValue(new PermanentError('nope'));
    await expect(
      withRetry(fn, { retries: 3, baseDelayMs: 1 }),
    ).rejects.toBeInstanceOf(PermanentError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries with last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      withRetry(fn, { retries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
