import type Anthropic from '@anthropic-ai/sdk';
import { APIError } from '@anthropic-ai/sdk';
import { EXTRACTION_MAX_INPUT_CHARS } from '@atomic-me/shared';
import type { Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { PermanentError, TransientError } from '../../lib/retry.js';
import {
  chunkText,
  extractAtomsFromAsset,
  normalizeKind,
} from '../extraction.js';

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

/** Build a fake Anthropic Message with a tool_use containing the given input. */
function makeMessage(
  toolInput: unknown,
  usage = { input_tokens: 100, output_tokens: 50 },
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    content: [
      {
        type: 'tool_use',
        id: 'toolu_1',
        name: 'submit_atoms',
        input: toolInput,
      },
    ],
  } as unknown as Anthropic.Message;
}

function makeClient(message: Anthropic.Message): Pick<Anthropic, 'messages'> {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(message),
    } as unknown as Anthropic['messages'],
  };
}

describe('normalizeKind', () => {
  it('UPPERCASEs and accepts valid kinds', () => {
    expect(normalizeKind('skill')).toBe('SKILL');
    expect(normalizeKind('Experience')).toBe('EXPERIENCE');
    expect(normalizeKind('LANGUAGE')).toBe('LANGUAGE');
  });
  it('maps role -> RESPONSIBILITY', () => {
    expect(normalizeKind('role')).toBe('RESPONSIBILITY');
    expect(normalizeKind('Role')).toBe('RESPONSIBILITY');
  });
  it('returns null for unknown kind', () => {
    expect(normalizeKind('hobby')).toBeNull();
    expect(normalizeKind('')).toBeNull();
  });
});

describe('chunkText', () => {
  it('returns 1 chunk when below threshold', () => {
    const chunks = chunkText('short text');
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.offset).toBe(0);
  });
  it('splits long text into multiple overlapping chunks', () => {
    const para = 'X'.repeat(8_000) + '\n\n' + 'Y'.repeat(8_000) + '\n\n' + 'Z'.repeat(8_000) +
      '\n\n' + 'W'.repeat(8_000);
    const chunks = chunkText(para);
    expect(chunks.length).toBeGreaterThan(1);
    // Chunks must cover the whole text.
    const last = chunks.at(-1);
    expect((last?.offset ?? 0) + (last?.text.length ?? 0)).toBeGreaterThanOrEqual(para.length - 100);
  });
});

describe('extractAtomsFromAsset', () => {
  const baseInput = (overrides: Partial<Parameters<typeof extractAtomsFromAsset>[0]> = {}) => ({
    assetId: 'asset_1',
    userId: 'user_1',
    parsedText: 'Jane Doe\nSenior Engineer at Acme, 2020-2023.\nSkill: Python.',
    sourceType: 'cv' as const,
    language: 'en',
    log: makeLog(),
    ...overrides,
  });

  it('happy path: returns validated atoms with absolute evidence offsets', async () => {
    const parsedText = 'Jane Doe\nSenior Engineer at Acme, 2020-2023.\nSkill: Python.';
    const snippet = 'Senior Engineer at Acme, 2020-2023.';
    const startOffset = parsedText.indexOf(snippet);
    const endOffset = startOffset + snippet.length;

    const skillStart = parsedText.indexOf('Python');
    const skillSnippet = 'Python';

    const llmOutput = {
      atoms: [
        {
          kind: 'EXPERIENCE',
          content: {
            company: 'Acme',
            title: 'Senior Engineer',
            startDate: '2020',
            endDate: '2023',
            description: 'Senior Engineer at Acme.',
          },
          evidenceSpan: { startOffset, endOffset, snippet },
          confidence: 0.9,
        },
        {
          kind: 'skill',
          content: { name: 'Python' },
          evidenceSpan: {
            startOffset: skillStart,
            endOffset: skillStart + skillSnippet.length,
            snippet: skillSnippet,
          },
          confidence: 0.95,
        },
      ],
      sourceLanguage: 'en',
    };

    const client = makeClient(makeMessage(llmOutput));
    const result = await extractAtomsFromAsset(baseInput({ parsedText, client }));

    expect(result.atoms.length).toBe(2);
    expect(result.rejectedCount).toBe(0);
    expect(result.sourceLanguage).toBe('en');
    expect(result.totalCostUsd).toBeGreaterThan(0);

    const exp = result.atoms[0];
    expect(exp?.kind).toBe('EXPERIENCE');
    expect(exp?.evidenceSpan.assetId).toBe('asset_1');
    expect(parsedText.slice(exp?.evidenceSpan.startOffset ?? 0, exp?.evidenceSpan.endOffset ?? 0)).toBe(snippet);

    const skill = result.atoms[1];
    expect(skill?.kind).toBe('SKILL'); // lowercase -> UPPERCASE
  });

  it('rejects atom when snippet does not match offsets', async () => {
    const parsedText = 'Hello world. Some other text.';
    const wrongOutput = {
      atoms: [
        {
          kind: 'SKILL',
          content: { name: 'Wrong' },
          evidenceSpan: { startOffset: 0, endOffset: 5, snippet: 'WRONG_TEXT' },
          confidence: 0.9,
        },
      ],
      sourceLanguage: 'en',
    };
    const client = makeClient(makeMessage(wrongOutput));
    const result = await extractAtomsFromAsset(baseInput({ parsedText, client }));
    expect(result.atoms.length).toBe(0);
    expect(result.rejectedCount).toBe(1);
  });

  it('rejects atom when content does not match discriminated union shape', async () => {
    const parsedText = 'Acme Corp 2020.';
    const badOutput = {
      atoms: [
        {
          // EXPERIENCE shape requires company/title/startDate/endDate/description.
          kind: 'EXPERIENCE',
          content: { name: 'just-a-name' },
          evidenceSpan: { startOffset: 0, endOffset: 10, snippet: 'Acme Corp ' },
          confidence: 0.9,
        },
      ],
      sourceLanguage: 'en',
    };
    const client = makeClient(makeMessage(badOutput));
    const result = await extractAtomsFromAsset(baseInput({ parsedText, client }));
    expect(result.atoms.length).toBe(0);
    expect(result.rejectedCount).toBe(1);
  });

  it('throws PermanentError when LLM does not call submit_atoms', async () => {
    const message = {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 50,
        output_tokens: 10,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      content: [{ type: 'text', text: 'I cannot extract atoms.' }],
    } as unknown as Anthropic.Message;
    const client = makeClient(message);
    await expect(extractAtomsFromAsset(baseInput({ client }))).rejects.toBeInstanceOf(
      PermanentError,
    );
  });

  it('throws PermanentError when LLM output fails Zod schema', async () => {
    const client = makeClient(makeMessage({ atoms: 'not an array', sourceLanguage: 'en' }));
    await expect(extractAtomsFromAsset(baseInput({ client }))).rejects.toBeInstanceOf(
      PermanentError,
    );
  });

  it('throws PermanentError on Anthropic 400 (invalid request)', async () => {
    const client: Pick<Anthropic, 'messages'> = {
      messages: {
        create: vi
          .fn()
          .mockRejectedValue(
            new APIError(
              400,
              { error: { type: 'invalid_request_error', message: 'bad prompt' } },
              'bad prompt',
              {},
            ),
          ),
      } as unknown as Anthropic['messages'],
    };
    await expect(extractAtomsFromAsset(baseInput({ client }))).rejects.toBeInstanceOf(
      PermanentError,
    );
  });

  it('throws TransientError on Anthropic 429 rate limit', async () => {
    const client: Pick<Anthropic, 'messages'> = {
      messages: {
        create: vi
          .fn()
          .mockRejectedValue(
            new APIError(
              429,
              { error: { type: 'rate_limit_error', message: 'slow down' } },
              'rate limit',
              {},
            ),
          ),
      } as unknown as Anthropic['messages'],
    };
    await expect(extractAtomsFromAsset(baseInput({ client }))).rejects.toBeInstanceOf(
      TransientError,
    );
  });

  it('rejects input > EXTRACTION_MAX_INPUT_CHARS upfront (PermanentError, no call)', async () => {
    const create = vi.fn();
    const client: Pick<Anthropic, 'messages'> = {
      messages: { create } as unknown as Anthropic['messages'],
    };
    const giantText = 'a'.repeat(EXTRACTION_MAX_INPUT_CHARS + 1);
    await expect(
      extractAtomsFromAsset(baseInput({ parsedText: giantText, client })),
    ).rejects.toBeInstanceOf(PermanentError);
    expect(create).not.toHaveBeenCalled();
  });
});
