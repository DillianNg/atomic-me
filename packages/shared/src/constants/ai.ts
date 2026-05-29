/**
 * AI / LLM constants chia se giua worker (Phase 7 extraction) va API (Phase 9 compose).
 *
 * Pricing duoc khai bao tai day de calculateCost() o worker khong cuong buc
 * import config xa la. Cap nhat tay khi Anthropic doi gia.
 *
 * Phase 7 quyet dinh:
 * - Model: Haiku 4.5 (re ~4x Sonnet, du quality cho extraction structured).
 * - Cost cap per asset: 0.15 USD. Vuot -> reject -> status FAILED.
 * - Max input ~ 25k tokens (~100k chars) before reject. CV >5 trang co the cham cap.
 * - Tool use forced ('submit_atoms'), non-streaming.
 */

/** Identifier model Anthropic cho extraction. Alias resolve tu dong sang version moi nhat. */
export const EXTRACTION_MODEL = 'claude-haiku-4-5' as const;

/** max_tokens cho 1 call Claude (output cap, ~50 atoms JSON la du). */
export const EXTRACTION_MAX_TOKENS = 8000;

/**
 * Hard cap input characters cho 1 asset. Vuot -> reject job + status FAILED.
 * Ratio thuc te ~ 4 chars / token => 100_000 chars ~ 25_000 input tokens.
 */
export const EXTRACTION_MAX_INPUT_CHARS = 100_000;

/** Temperature 0 cho extraction (deterministic, repro-able). */
export const EXTRACTION_TEMPERATURE = 0;

/** Cost cap per asset (USD). Vuot estimate truoc khi call Claude -> reject. */
export const EXTRACTION_COST_CAP_USD = 0.15;

/** Chunk size khi text qua dai. 12k chars ~ 3k tokens, du Haiku 4.5 context. */
export const EXTRACTION_CHUNK_SIZE_CHARS = 12_000;

/** Overlap giua cac chunk de tranh atom dai bi cat doi. */
export const EXTRACTION_CHUNK_OVERLAP_CHARS = 500;

/** Threshold text length de bat dau chunk. Duoi nguong: 1 call. */
export const EXTRACTION_CHUNK_THRESHOLD_CHARS = 30_000;

/**
 * Bang gia Anthropic (USD per 1M tokens).
 * Cap nhat tu https://www.anthropic.com/pricing khi doi gia.
 * Phase 7: chi Haiku 4.5 duoc su dung; Sonnet/Opus tham khao cho Phase sau.
 *
 * NOTE: Haiku 4.5 pricing la conservative estimate ($1/$5 per M).
 * Verify sau khi co API key thuc te tu Anthropic console.
 */
export const ANTHROPIC_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  'claude-haiku-4-5': { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  'claude-sonnet-4-5': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-sonnet-4-5-20250929': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
};

/**
 * Tinh cost (USD) dua tren model + token counts.
 * Tra 0 neu khong biet model (caller tu log warn).
 */
export function calculateLlmCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = ANTHROPIC_PRICING[model];
  if (!pricing) return 0;
  return (
    (inputTokens * pricing.inputPerMillion) / 1_000_000 +
    (outputTokens * pricing.outputPerMillion) / 1_000_000
  );
}
