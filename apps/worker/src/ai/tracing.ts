import { calculateLlmCostUsd } from '@atomic-me/shared';
import type { Logger } from 'pino';

import { env } from '../config/env.js';

/**
 * Tracing wrapper cho moi call Claude.
 *
 * Phase 7: pino fallback (Langfuse SDK chua wire). Khi env LANGFUSE_*
 * day du -> co the lazy-import Langfuse client va replace log impl.
 * Hien tai luon log qua pino, KHONG throw du Langfuse co loi.
 *
 * Field log: name, model, promptVersion, inputTokens, outputTokens,
 * costUsd, latencyMs, userId, assetId, chunkIndex.
 */

export interface TracedContext {
  /** Identifier cua span. Vd 'extract-atoms.chunk'. */
  name: string;
  /** Phien ban prompt (extract-atom@v1.0.0). */
  promptVersion: string;
  /** Model id Anthropic. */
  model: string;
  /** User ID (cho audit + Langfuse session). */
  userId: string;
  /** Asset ID (cho debug + tracking cost per asset). */
  assetId: string;
  /** 0-based chunk index khi text bi chunk. Null neu 1 call. */
  chunkIndex: number | null;
}

export interface TracedUsage {
  /** Input tokens (tu Anthropic usage). */
  inputTokens: number;
  /** Output tokens. */
  outputTokens: number;
}

export interface TracedResult<T> {
  data: T;
  usage: TracedUsage;
  costUsd: number;
  latencyMs: number;
}

/** True neu da cau hinh Langfuse env (Phase 7 chi log sentinel; sdk wire o Phase sau). */
export function isLangfuseConfigured(): boolean {
  return Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

/**
 * Wrap fn() (1 call Claude) + do latency + tinh cost + log.
 * fn() PHAI tra ra { data, usage } de tracing biet tokens.
 *
 * Loi tu fn() bubble nguyen ven (caller xu ly TransientError / PermanentError).
 */
export async function traced<T>(
  ctx: TracedContext,
  log: Logger,
  fn: () => Promise<{ data: T; usage: TracedUsage }>,
): Promise<TracedResult<T>> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - startedAt;
    const costUsd = calculateLlmCostUsd(
      ctx.model,
      result.usage.inputTokens,
      result.usage.outputTokens,
    );
    log.info(
      {
        span: ctx.name,
        model: ctx.model,
        promptVersion: ctx.promptVersion,
        userId: ctx.userId,
        assetId: ctx.assetId,
        chunkIndex: ctx.chunkIndex,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd,
        latencyMs,
        langfuse: isLangfuseConfigured(),
      },
      'llm.call',
    );
    return {
      data: result.data,
      usage: result.usage,
      costUsd,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    log.error(
      {
        span: ctx.name,
        model: ctx.model,
        promptVersion: ctx.promptVersion,
        userId: ctx.userId,
        assetId: ctx.assetId,
        chunkIndex: ctx.chunkIndex,
        latencyMs,
        err,
      },
      'llm.call.failed',
    );
    throw err;
  }
}
