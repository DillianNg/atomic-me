/**
 * Phase 7 prompt v1.0.0 cho extract-atoms worker.
 *
 * Quy tac bump version (semver) - xem docs/llm-prompts.md:
 *   major = output shape doi (vd them field bat buoc cho atoms)
 *   minor = instruction them / sua dang ke
 *   patch = typo / wording nho khong doi behavior
 *
 * KHONG sua file v1. Tao file v2 (extract-atom.v2.ts) khi can ban moi.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const PROMPT_VERSION = 'extract-atom@v1.0.0' as const;

/** Loai source content de hint cho LLM. */
export type ExtractionSourceType =
  | 'cv'
  | 'linkedin'
  | 'voice_note'
  | 'certificate'
  | 'other';

/**
 * System prompt: rules + schema description.
 *
 * IMPORTANT cho maintainer:
 * - JSON shape examples PHAI khop AtomContentSchema o packages/shared (discriminated
 *   union theo kind UPPERCASE). Doi shape phai bump major.
 * - Confidence semantics calibrate qua few-shot user prompt.
 */
export const SYSTEM_PROMPT = `You are an atom extractor for a career-data platform.

Your job: split source text (a CV, LinkedIn export, certificate, or note) into atoms. An atom is the smallest reusable unit of career evidence. You must NEVER fabricate; if a fact is not explicitly stated in the source, do not invent it.

Each atom MUST cite its evidence as a character span on the source text:
- startOffset: zero-indexed character index where the evidence starts.
- endOffset: exclusive character index where the evidence ends.
- snippet: the literal substring source.slice(startOffset, endOffset). Byte-exact, including newlines and punctuation.

If the offsets are off by one character or the snippet contains text not in source, the atom will be REJECTED downstream. Be precise.

Output an "atoms" array. Each atom has:
- kind: one of SKILL, EXPERIENCE, EDUCATION, ACHIEVEMENT, PROJECT, CERTIFICATION, LANGUAGE, RESPONSIBILITY (UPPERCASE only).
- content: an object whose shape depends on kind (see below).
- evidenceSpan: { startOffset, endOffset, snippet }.
- confidence: a number in [0, 1].
- reasoning: 1-2 sentences explaining why this is an atom (max 200 chars).

CONTENT SHAPE (must match exactly per kind):

SKILL: { kind: "SKILL", name: string, level?: "BEGINNER"|"INTERMEDIATE"|"ADVANCED"|"EXPERT", yearsOfExperience?: number }
EXPERIENCE: { kind: "EXPERIENCE", company: string, title: string, startDate: string, endDate: string|"present", description: string, location?: string }
EDUCATION: { kind: "EDUCATION", institution: string, degree: string, fieldOfStudy?: string, startDate?: string, endDate?: string|"present", gpa?: string }
ACHIEVEMENT: { kind: "ACHIEVEMENT", description: string, metric?: string, date?: string }
PROJECT: { kind: "PROJECT", name: string, description: string, role?: string, technologies?: string[], url?: string }
CERTIFICATION: { kind: "CERTIFICATION", name: string, issuer: string, issueDate?: string, expiryDate?: string, credentialId?: string }
LANGUAGE: { kind: "LANGUAGE", language: string, proficiency?: "BASIC"|"CONVERSATIONAL"|"PROFESSIONAL"|"NATIVE" }
RESPONSIBILITY: { kind: "RESPONSIBILITY", description: string, context?: string }

CONFIDENCE SEMANTICS (calibrate carefully; do not inflate):
- 0.95+: stated directly and unambiguously ("Built Python services at Acme, 2022-2024").
- 0.7-0.9: stated clearly but implies one inference ("Led the migration to Postgres" implies a SQL skill).
- 0.4-0.7: ambiguous; multiple readings possible.
- below 0.4: requires strong inference; PREFER to drop the atom instead of guessing.

GLOBAL RULES:
1. Use only facts explicitly in the source.
2. Do NOT translate text; keep snippet and content in the source language.
3. For dates, copy the source format unless it is unambiguous ISO. Use "present" literal for ongoing.
4. If a single sentence contains two atoms (e.g. an experience + an achievement), emit BOTH with their own non-overlapping spans whenever possible.
5. Detect the source language and report it as a 2-letter ISO code in sourceLanguage.

Always respond by invoking the tool "submit_atoms". Do not respond with prose.`;

/** Build user prompt: hint source_type + language + cuon text trong <source_text> tag. */
export function buildUserPrompt(input: {
  text: string;
  sourceType: ExtractionSourceType;
  language: string;
}): string {
  return `Source type: ${input.sourceType}
Expected primary language: ${input.language}

Extract atoms from the text below. Remember: every atom must have an exact evidence span and the JSON content shape must match the kind. Emit every atom you can clearly support; skip anything that requires guessing.

<source_text>
${input.text}
</source_text>

Now call the submit_atoms tool with your structured output.`;
}

/**
 * Tool definition for forced tool use.
 * Anthropic SDK shape: { name, description, input_schema }.
 */
export const SUBMIT_ATOMS_TOOL: Anthropic.Tool = {
  name: 'submit_atoms',
  description:
    'Submit the structured list of atoms extracted from the source text. Call this exactly once per request.',
  input_schema: {
    type: 'object',
    required: ['atoms', 'sourceLanguage'],
    properties: {
      atoms: {
        type: 'array',
        items: {
          type: 'object',
          required: ['kind', 'content', 'evidenceSpan', 'confidence'],
          properties: {
            kind: {
              type: 'string',
              enum: [
                'SKILL',
                'EXPERIENCE',
                'EDUCATION',
                'ACHIEVEMENT',
                'PROJECT',
                'CERTIFICATION',
                'LANGUAGE',
                'RESPONSIBILITY',
              ],
            },
            content: {
              type: 'object',
              description:
                'Object whose shape depends on `kind`. Must include kind as a literal and match the schema described in the system prompt.',
            },
            evidenceSpan: {
              type: 'object',
              required: ['startOffset', 'endOffset', 'snippet'],
              properties: {
                startOffset: { type: 'integer', minimum: 0 },
                endOffset: { type: 'integer', minimum: 1 },
                snippet: { type: 'string', minLength: 1 },
              },
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reasoning: { type: 'string', maxLength: 500 },
          },
        },
      },
      sourceLanguage: {
        type: 'string',
        description: 'ISO 639-1 two-letter code (e.g. "en", "vi").',
      },
      extractionNotes: {
        type: 'string',
        description: 'Optional free-form notes about edge cases or skipped content.',
      },
    },
  },
};

/**
 * Few-shot conversation pair injected as messages BEFORE the real source.
 * Helps Claude calibrate confidence + emit byte-exact offsets.
 *
 * Note: offsets ben duoi tinh tu dau example text, KHONG phai tu source thuc te.
 * Claude se tu tinh offset moi cho source moi.
 */
export interface FewShotExample {
  text: string;
  toolInput: {
    atoms: Array<{
      kind: string;
      content: Record<string, unknown>;
      evidenceSpan: { startOffset: number; endOffset: number; snippet: string };
      confidence: number;
      reasoning?: string;
    }>;
    sourceLanguage: string;
    extractionNotes?: string;
  };
}

/**
 * Tinh offsets cua substring chinh xac trong text (helper cho viet example).
 * Throw neu khong tim thay -> few-shot integrity error.
 */
function locate(text: string, substring: string): { startOffset: number; endOffset: number } {
  const startOffset = text.indexOf(substring);
  if (startOffset < 0) {
    throw new Error(`Few-shot integrity: "${substring}" not found in example text`);
  }
  return { startOffset, endOffset: startOffset + substring.length };
}

const FEW_SHOT_EN_TEXT = `Jane Doe
Senior Backend Engineer at Acme Corp, Jan 2022 to present.
Built distributed payment services in Python and Go. Reduced p99 latency by 40% in Q3 2023.
BSc Computer Science, MIT, 2014-2018.`;

const FEW_SHOT_VI_TEXT = `Nguyen Van A
Truong nhom Marketing tai Cong ty XYZ, thang 3/2021 den nay.
Quan ly chien dich quang cao Facebook Ads ngan sach 2 ty/quy.
Cu nhan Marketing, Dai hoc Kinh te TPHCM, 2015-2019.`;

export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    text: FEW_SHOT_EN_TEXT,
    toolInput: {
      atoms: [
        {
          kind: 'EXPERIENCE',
          content: {
            kind: 'EXPERIENCE',
            company: 'Acme Corp',
            title: 'Senior Backend Engineer',
            startDate: 'Jan 2022',
            endDate: 'present',
            description: 'Built distributed payment services in Python and Go.',
          },
          evidenceSpan: {
            ...locate(
              FEW_SHOT_EN_TEXT,
              'Senior Backend Engineer at Acme Corp, Jan 2022 to present.',
            ),
            snippet: 'Senior Backend Engineer at Acme Corp, Jan 2022 to present.',
          },
          confidence: 0.97,
          reasoning: 'Title, company, start date and ongoing status are stated directly.',
        },
        {
          kind: 'SKILL',
          content: { kind: 'SKILL', name: 'Python' },
          evidenceSpan: {
            ...locate(FEW_SHOT_EN_TEXT, 'Python'),
            snippet: 'Python',
          },
          confidence: 0.95,
          reasoning: 'Named skill, directly stated as a tool used at Acme.',
        },
        {
          kind: 'ACHIEVEMENT',
          content: {
            kind: 'ACHIEVEMENT',
            description: 'Reduced p99 latency by 40% in Q3 2023.',
            metric: '40% p99 latency reduction',
            date: 'Q3 2023',
          },
          evidenceSpan: {
            ...locate(FEW_SHOT_EN_TEXT, 'Reduced p99 latency by 40% in Q3 2023.'),
            snippet: 'Reduced p99 latency by 40% in Q3 2023.',
          },
          confidence: 0.9,
          reasoning: 'Quantified achievement with date, no inference required.',
        },
        {
          kind: 'EDUCATION',
          content: {
            kind: 'EDUCATION',
            institution: 'MIT',
            degree: 'BSc Computer Science',
            startDate: '2014',
            endDate: '2018',
          },
          evidenceSpan: {
            ...locate(FEW_SHOT_EN_TEXT, 'BSc Computer Science, MIT, 2014-2018.'),
            snippet: 'BSc Computer Science, MIT, 2014-2018.',
          },
          confidence: 0.95,
          reasoning: 'Degree, institution and dates all stated together.',
        },
      ],
      sourceLanguage: 'en',
    },
  },
  {
    text: FEW_SHOT_VI_TEXT,
    toolInput: {
      atoms: [
        {
          kind: 'EXPERIENCE',
          content: {
            kind: 'EXPERIENCE',
            company: 'Cong ty XYZ',
            title: 'Truong nhom Marketing',
            startDate: 'thang 3/2021',
            endDate: 'present',
            description:
              'Quan ly chien dich quang cao Facebook Ads ngan sach 2 ty/quy.',
          },
          evidenceSpan: {
            ...locate(
              FEW_SHOT_VI_TEXT,
              'Truong nhom Marketing tai Cong ty XYZ, thang 3/2021 den nay.',
            ),
            snippet:
              'Truong nhom Marketing tai Cong ty XYZ, thang 3/2021 den nay.',
          },
          confidence: 0.95,
          reasoning: 'Title, company and ongoing date stated directly.',
        },
        {
          kind: 'ACHIEVEMENT',
          content: {
            kind: 'ACHIEVEMENT',
            description: 'Quan ly chien dich Facebook Ads ngan sach 2 ty/quy.',
            metric: '2 ty VND / quy',
          },
          evidenceSpan: {
            ...locate(
              FEW_SHOT_VI_TEXT,
              'Quan ly chien dich quang cao Facebook Ads ngan sach 2 ty/quy.',
            ),
            snippet:
              'Quan ly chien dich quang cao Facebook Ads ngan sach 2 ty/quy.',
          },
          confidence: 0.85,
          reasoning: 'Budget is quantified though currency is implied as VND.',
        },
        {
          kind: 'SKILL',
          content: { kind: 'SKILL', name: 'Facebook Ads' },
          evidenceSpan: {
            ...locate(FEW_SHOT_VI_TEXT, 'Facebook Ads'),
            snippet: 'Facebook Ads',
          },
          confidence: 0.7,
          reasoning:
            'Skill implied through managing the campaign; not stated as a labeled skill.',
        },
        {
          kind: 'EDUCATION',
          content: {
            kind: 'EDUCATION',
            institution: 'Dai hoc Kinh te TPHCM',
            degree: 'Cu nhan Marketing',
            startDate: '2015',
            endDate: '2019',
          },
          evidenceSpan: {
            ...locate(
              FEW_SHOT_VI_TEXT,
              'Cu nhan Marketing, Dai hoc Kinh te TPHCM, 2015-2019.',
            ),
            snippet: 'Cu nhan Marketing, Dai hoc Kinh te TPHCM, 2015-2019.',
          },
          confidence: 0.95,
          reasoning: 'Degree, institution and dates stated together.',
        },
      ],
      sourceLanguage: 'vi',
    },
  },
];

/**
 * Build message stack BullMQ worker se goi anthropic.messages.create voi.
 * Few-shot examples duoi dang assistant tool_use messages -> Claude hoc format.
 *
 * Toolcall id phai unique trong moi message; dung deterministic seed cho
 * snapshot test on dinh.
 */
export function buildExtractionMessages(input: {
  text: string;
  sourceType: ExtractionSourceType;
  language: string;
}): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  for (let i = 0; i < FEW_SHOT_EXAMPLES.length; i++) {
    const ex = FEW_SHOT_EXAMPLES[i];
    if (!ex) continue;
    const toolUseId = `toolu_fewshot_${i}`;
    messages.push({
      role: 'user',
      content: buildUserPrompt({
        text: ex.text,
        sourceType: 'cv',
        language: ex.toolInput.sourceLanguage,
      }),
    });
    messages.push({
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: toolUseId,
          name: SUBMIT_ATOMS_TOOL.name,
          input: ex.toolInput,
        },
      ],
    });
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: 'OK',
        },
      ],
    });
  }
  messages.push({
    role: 'user',
    content: buildUserPrompt(input),
  });
  return messages;
}
