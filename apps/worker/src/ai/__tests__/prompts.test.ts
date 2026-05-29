import { describe, expect, it } from 'vitest';

import {
  buildExtractionMessages,
  buildUserPrompt,
  FEW_SHOT_EXAMPLES,
  PROMPT_VERSION,
  SUBMIT_ATOMS_TOOL,
  SYSTEM_PROMPT,
  type ExtractionSourceType,
} from '../prompts/extract-atom.v1.js';

describe('extract-atom prompt v1', () => {
  it('locks PROMPT_VERSION at v1.0.0', () => {
    expect(PROMPT_VERSION).toBe('extract-atom@v1.0.0');
  });

  it('system prompt contains all 8 atom kinds', () => {
    const kinds = [
      'SKILL',
      'EXPERIENCE',
      'EDUCATION',
      'ACHIEVEMENT',
      'PROJECT',
      'CERTIFICATION',
      'LANGUAGE',
      'RESPONSIBILITY',
    ];
    for (const k of kinds) {
      expect(SYSTEM_PROMPT).toContain(k);
    }
    expect(SYSTEM_PROMPT).toContain('submit_atoms');
  });

  it('SUBMIT_ATOMS_TOOL enforces UPPERCASE kind enum', () => {
    const props = SUBMIT_ATOMS_TOOL.input_schema.properties as Record<string, unknown>;
    const atomsSchema = props['atoms'] as Record<string, unknown>;
    const itemsSchema = atomsSchema['items'] as Record<string, unknown>;
    const itemProps = itemsSchema['properties'] as Record<string, unknown>;
    const kindSchema = itemProps['kind'] as { enum: string[] };
    expect(kindSchema.enum).toContain('SKILL');
    expect(kindSchema.enum).toContain('RESPONSIBILITY');
    expect(kindSchema.enum).not.toContain('role');
  });

  it.each<[ExtractionSourceType, string]>([
    ['cv', 'cv'],
    ['linkedin', 'linkedin'],
    ['voice_note', 'voice_note'],
    ['certificate', 'certificate'],
  ])('buildUserPrompt embeds source type %s and wraps text', (sourceType) => {
    const prompt = buildUserPrompt({
      text: 'Sample CV text.',
      sourceType,
      language: 'en',
    });
    expect(prompt).toContain(`Source type: ${sourceType}`);
    expect(prompt).toContain('<source_text>\nSample CV text.\n</source_text>');
    expect(prompt).toContain('submit_atoms');
  });

  it('few-shot examples have byte-exact snippets', () => {
    for (const ex of FEW_SHOT_EXAMPLES) {
      for (const atom of ex.toolInput.atoms) {
        const { startOffset, endOffset, snippet } = atom.evidenceSpan;
        const slice = ex.text.slice(startOffset, endOffset);
        expect(slice).toBe(snippet);
      }
    }
  });

  it('few-shot covers EN + VI with mixed confidence', () => {
    expect(FEW_SHOT_EXAMPLES.length).toBe(2);
    const enExample = FEW_SHOT_EXAMPLES[0];
    const viExample = FEW_SHOT_EXAMPLES[1];
    expect(enExample?.toolInput.sourceLanguage).toBe('en');
    expect(viExample?.toolInput.sourceLanguage).toBe('vi');
    const confidences = [
      ...(enExample?.toolInput.atoms.map((a) => a.confidence) ?? []),
      ...(viExample?.toolInput.atoms.map((a) => a.confidence) ?? []),
    ];
    expect(Math.min(...confidences)).toBeLessThanOrEqual(0.75);
    expect(Math.max(...confidences)).toBeGreaterThanOrEqual(0.95);
  });

  it('buildExtractionMessages prefixes few-shot then the real prompt', () => {
    const msgs = buildExtractionMessages({
      text: 'Real CV text.',
      sourceType: 'cv',
      language: 'en',
    });
    // 2 examples * 3 messages (user, assistant tool_use, user tool_result) + final user = 7
    expect(msgs.length).toBe(7);
    expect(msgs[0]?.role).toBe('user');
    expect(msgs[1]?.role).toBe('assistant');
    expect(msgs[2]?.role).toBe('user');
    expect(msgs.at(-1)?.role).toBe('user');
    expect(JSON.stringify(msgs.at(-1)?.content)).toContain('Real CV text.');
  });

  it('buildUserPrompt snapshot for source type cv (en)', () => {
    expect(
      buildUserPrompt({
        text: 'Hello world CV.',
        sourceType: 'cv',
        language: 'en',
      }),
    ).toMatchInlineSnapshot(`
      "Source type: cv
      Expected primary language: en

      Extract atoms from the text below. Remember: every atom must have an exact evidence span and the JSON content shape must match the kind. Emit every atom you can clearly support; skip anything that requires guessing.

      <source_text>
      Hello world CV.
      </source_text>

      Now call the submit_atoms tool with your structured output."
    `);
  });
});
