import type Anthropic from '@anthropic-ai/sdk';
import { APIError } from '@anthropic-ai/sdk';
import {
  AtomContentSchema,
  AtomKindSchema,
  EXTRACTION_CHUNK_OVERLAP_CHARS,
  EXTRACTION_CHUNK_SIZE_CHARS,
  EXTRACTION_CHUNK_THRESHOLD_CHARS,
  EXTRACTION_MAX_INPUT_CHARS,
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_MODEL,
  EXTRACTION_TEMPERATURE,
  LLMExtractionResultSchema,
  type AtomCreateInput,
  type AtomKind,
  type LLMExtractionAtom,
  type LLMExtractionResult,
} from '@atomic-me/shared';
import type { Logger } from 'pino';

import { PermanentError, TransientError } from '../lib/retry.js';

import { anthropic as defaultAnthropic } from './client.js';
import {
  buildExtractionMessages,
  PROMPT_VERSION,
  SUBMIT_ATOMS_TOOL,
  SYSTEM_PROMPT,
  type ExtractionSourceType,
} from './prompts/extract-atom.v1.js';
import { traced } from './tracing.js';

export { PROMPT_VERSION };

export interface ExtractAtomsInput {
  assetId: string;
  userId: string;
  parsedText: string;
  sourceType: ExtractionSourceType;
  language: string;
  log: Logger;
  /** Cho phep test inject Anthropic mock. */
  client?: Pick<Anthropic, 'messages'>;
}

export interface ExtractAtomsResult {
  atoms: AtomCreateInput[];
  totalCostUsd: number;
  rejectedCount: number;
  inputCharCount: number;
  chunkCount: number;
  sourceLanguage: string;
}

interface Chunk {
  text: string;
  /** Absolute start in source text. */
  offset: number;
  index: number;
}

/**
 * Chia text theo paragraph (\n\n) thanh chunk; max EXTRACTION_CHUNK_SIZE_CHARS,
 * overlap EXTRACTION_CHUNK_OVERLAP_CHARS giua cac chunk.
 *
 * Algo:
 * - Neu text <= threshold -> 1 chunk.
 * - Else: iterate paragraph; accumulate cho toi khi vuot CHUNK_SIZE_CHARS.
 *   Khi flush chunk: cat het CHUNK_SIZE_CHARS; lan sau start tu currentOffset - OVERLAP.
 */
export function chunkText(text: string): Chunk[] {
  if (text.length <= EXTRACTION_CHUNK_THRESHOLD_CHARS) {
    return [{ text, offset: 0, index: 0 }];
  }
  const chunks: Chunk[] = [];
  let offset = 0;
  let index = 0;
  while (offset < text.length) {
    const end = Math.min(offset + EXTRACTION_CHUNK_SIZE_CHARS, text.length);
    let cutEnd = end;
    if (end < text.length) {
      // Tim paragraph boundary (\n\n) gan nhat truoc cutEnd. Neu khong co, dung end.
      const nl = text.lastIndexOf('\n\n', end);
      if (nl > offset + EXTRACTION_CHUNK_SIZE_CHARS / 2) {
        cutEnd = nl;
      }
    }
    chunks.push({ text: text.slice(offset, cutEnd), offset, index });
    if (cutEnd >= text.length) break;
    offset = Math.max(0, cutEnd - EXTRACTION_CHUNK_OVERLAP_CHARS);
    index++;
  }
  return chunks;
}

/** Normalize kind string tu LLM ve UPPERCASE AtomKind, map 'role' -> RESPONSIBILITY. */
export function normalizeKind(rawKind: string): AtomKind | null {
  const upper = rawKind.trim().toUpperCase();
  if (upper === 'ROLE') return 'RESPONSIBILITY';
  const parsed = AtomKindSchema.safeParse(upper);
  return parsed.success ? parsed.data : null;
}

/**
 * Phan loai Anthropic SDK error de phan biet retry / not-retry.
 * - 401/403/400 -> PermanentError.
 * - 429 / 5xx / timeout -> TransientError.
 */
function classifyAnthropicError(err: unknown): never {
  if (err instanceof APIError) {
    const status = err.status ?? 0;
    if (status === 401 || status === 403 || status === 400) {
      throw new PermanentError(`Anthropic API ${status}: ${err.message}`, { cause: err });
    }
    if (status === 429 || (status >= 500 && status < 600)) {
      throw new TransientError(`Anthropic API ${status}: ${err.message}`, { cause: err });
    }
  }
  // Timeout / network / unknown.
  throw new TransientError(
    `Anthropic call failed: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err },
  );
}

/**
 * Pick block 'tool_use' tu response Claude. Reject neu khong co tool_use
 * (Claude tra text-only -> prompt fail -> PermanentError de UI re-engineer prompt).
 */
function extractToolUseInput(
  message: Anthropic.Message,
  log: Logger,
): Record<string, unknown> {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === SUBMIT_ATOMS_TOOL.name,
  );
  if (!toolUse) {
    log.warn(
      { content: message.content.map((b) => b.type) },
      'No submit_atoms tool_use in response',
    );
    throw new PermanentError('Model did not call submit_atoms');
  }
  if (typeof toolUse.input !== 'object' || toolUse.input === null) {
    throw new PermanentError('submit_atoms tool input is not an object');
  }
  return toolUse.input as Record<string, unknown>;
}

/**
 * Validate + normalize 1 atom LLM -> AtomCreateInput.
 * Tra null neu reject (caller count vao rejectedCount + log).
 */
function processLlmAtom(args: {
  llmAtom: LLMExtractionAtom;
  fullParsedText: string;
  chunkOffset: number;
  assetId: string;
  userId: string;
  log: Logger;
}): AtomCreateInput | null {
  const { llmAtom, fullParsedText, chunkOffset, assetId, userId, log } = args;

  // 1. Normalize kind.
  const kind = normalizeKind(llmAtom.kind);
  if (!kind) {
    log.warn({ rawKind: llmAtom.kind }, 'atom rejected: unknown kind');
    return null;
  }

  // 2. Adjust offsets to absolute coords on full parsedText.
  const startOffset = llmAtom.evidenceSpan.startOffset + chunkOffset;
  const endOffset = llmAtom.evidenceSpan.endOffset + chunkOffset;
  if (startOffset < 0 || endOffset > fullParsedText.length || endOffset <= startOffset) {
    log.warn({ startOffset, endOffset }, 'atom rejected: offsets out of range');
    return null;
  }

  // 3. Byte-exact snippet verification (no trim, no normalize).
  const actualSnippet = fullParsedText.slice(startOffset, endOffset);
  if (actualSnippet !== llmAtom.evidenceSpan.snippet) {
    log.warn(
      {
        startOffset,
        endOffset,
        expected: llmAtom.evidenceSpan.snippet.slice(0, 80),
        actual: actualSnippet.slice(0, 80),
      },
      'atom rejected: snippet does not match offsets',
    );
    return null;
  }

  // 4. Validate content shape against strict AtomContentSchema (discriminated union).
  // LLM may not include 'kind' inside content; inject it for the discriminator.
  const contentWithKind = { ...llmAtom.content, kind };
  const contentParsed = AtomContentSchema.safeParse(contentWithKind);
  if (!contentParsed.success) {
    log.warn(
      { kind, errors: contentParsed.error.flatten() },
      'atom rejected: content does not match kind schema',
    );
    return null;
  }

  return {
    userId,
    assetId,
    kind,
    content: contentParsed.data,
    evidenceSpan: {
      assetId,
      startOffset,
      endOffset,
      snippet: llmAtom.evidenceSpan.snippet,
    },
    confidence: llmAtom.confidence,
  };
}

/**
 * Goi Claude cho 1 chunk va validate ket qua qua LLMExtractionResultSchema.
 */
async function extractChunk(args: {
  chunk: Chunk;
  input: ExtractAtomsInput;
  client: Pick<Anthropic, 'messages'>;
}): Promise<{ result: LLMExtractionResult; inputTokens: number; outputTokens: number }> {
  const { chunk, input, client } = args;
  const messages = buildExtractionMessages({
    text: chunk.text,
    sourceType: input.sourceType,
    language: input.language,
  });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: EXTRACTION_MAX_TOKENS,
      temperature: EXTRACTION_TEMPERATURE,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_ATOMS_TOOL],
      tool_choice: { type: 'tool', name: SUBMIT_ATOMS_TOOL.name },
      messages,
    });
  } catch (err) {
    classifyAnthropicError(err);
  }

  const toolInput = extractToolUseInput(response, input.log);
  const parsed = LLMExtractionResultSchema.safeParse(toolInput);
  if (!parsed.success) {
    input.log.warn(
      { errors: parsed.error.flatten(), chunkIndex: chunk.index },
      'LLM tool input failed Zod validation',
    );
    throw new PermanentError('LLM output failed Zod schema validation');
  }

  return {
    result: parsed.data,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Entry point: extract atoms tu Asset.parsedText.
 *
 * Flow:
 * 1. Check char budget: > EXTRACTION_MAX_INPUT_CHARS -> PermanentError.
 * 2. Chunk text.
 * 3. Voi moi chunk: traced(call Claude); process atoms; accumulate.
 * 4. Cross-chunk dedup theo (kind, snippet).
 */
export async function extractAtomsFromAsset(
  input: ExtractAtomsInput,
): Promise<ExtractAtomsResult> {
  const { parsedText, log } = input;

  if (parsedText.length > EXTRACTION_MAX_INPUT_CHARS) {
    throw new PermanentError(
      `Input too large: ${parsedText.length} chars > ${EXTRACTION_MAX_INPUT_CHARS} cap`,
    );
  }

  const client = input.client ?? defaultAnthropic;
  const chunks = chunkText(parsedText);
  log.info({ chunkCount: chunks.length, charCount: parsedText.length }, 'extraction.start');

  const allAtoms: AtomCreateInput[] = [];
  let totalCostUsd = 0;
  let rejectedCount = 0;
  let sourceLanguage = input.language;

  for (const chunk of chunks) {
    const traced_ = await traced(
      {
        name: 'extract-atoms.chunk',
        promptVersion: PROMPT_VERSION,
        model: EXTRACTION_MODEL,
        userId: input.userId,
        assetId: input.assetId,
        chunkIndex: chunk.index,
      },
      log,
      async () => {
        const { result, inputTokens, outputTokens } = await extractChunk({
          chunk,
          input,
          client,
        });
        return { data: result, usage: { inputTokens, outputTokens } };
      },
    );
    totalCostUsd += traced_.costUsd;
    sourceLanguage = traced_.data.sourceLanguage;

    for (const llmAtom of traced_.data.atoms) {
      const atom = processLlmAtom({
        llmAtom,
        fullParsedText: parsedText,
        chunkOffset: chunk.offset,
        assetId: input.assetId,
        userId: input.userId,
        log,
      });
      if (atom) {
        allAtoms.push(atom);
      } else {
        rejectedCount++;
      }
    }
  }

  // Cross-chunk dedup theo (kind, snippet exact match).
  const seen = new Set<string>();
  const deduped: AtomCreateInput[] = [];
  for (const atom of allAtoms) {
    const key = `${atom.kind}::${atom.evidenceSpan.snippet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(atom);
  }

  log.info(
    {
      kept: deduped.length,
      duplicates: allAtoms.length - deduped.length,
      rejected: rejectedCount,
      totalCostUsd,
      sourceLanguage,
    },
    'extraction.done',
  );

  return {
    atoms: deduped,
    totalCostUsd,
    rejectedCount,
    inputCharCount: parsedText.length,
    chunkCount: chunks.length,
    sourceLanguage,
  };
}
