# LLM prompts

This is the operational doc for every prompt the worker (and later the API)
sends to a language model. New prompts must follow the versioning policy
below; old prompts are never edited.

## File layout

```
apps/worker/src/ai/prompts/
├── extract-atom.v1.ts     Phase 7, active
├── extract-atom.v2.ts     when needed; v1 stays
└── ...
```

Each file exports:

```ts
export const PROMPT_VERSION = 'extract-atom@vX.Y.Z';
export const SYSTEM_PROMPT: string;
export function buildUserPrompt(...): string;
export const SUBMIT_ATOMS_TOOL: Anthropic.Tool;        // when tool use is forced
export function buildExtractionMessages(...): Anthropic.MessageParam[];
```

## Versioning policy (semver)

We bump the version when ANY of these change:

| Bump | Trigger |
|------|---------|
| **major** (v1 -> v2) | Output shape changes. The downstream Zod schema or `AtomContentSchema` discriminator changes. Existing callers must update before switching. |
| **minor** (v1.0 -> v1.1) | Instructions added or removed in a way that meaningfully changes which atoms get extracted. Tool schema unchanged. Few-shot examples added/removed. |
| **patch** (v1.0.0 -> v1.0.1) | Typos, wording polish, comment edits. No behavior change expected. |

Rules:

1. **Never edit an existing file.** Create `extract-atom.v2.ts` next to v1.
2. **PROMPT_VERSION lives in the file.** Tests pin the constant so an
   accidental rename breaks the build.
3. The constant string is what worker writes to `Atom.promptVersion` so
   reports can group atoms by exact version.
4. To run an A/B, both versions stay deployed; pick at job-enqueue time
   (Phase 8+ feature).

## Metrics to track per version

Phase 7 only ships v1. Once we have data, fill this table per release and
keep it in this file.

| Version | Date | Asset sample | Avg cost USD | Avg atoms / CV | Evidence mismatch rate | Rejected atom rate | Notes |
|---------|------|--------------|--------------|----------------|-----------------------|---------------------|-------|
| extract-atom@v1.0.0 | 2026-05-29 | TBD after first prod run | TBD | TBD | TBD | TBD | Initial release, Haiku 4.5, tool-use forced. |

## How to add a new version

1. Copy `extract-atom.v{X}.ts` to `extract-atom.v{X+1}.ts`.
2. Bump `PROMPT_VERSION`.
3. Edit text / tool schema / few-shot in the new file.
4. Add a row to the metrics table.
5. Re-run unit tests (`prompts.test.ts` covers v1; add a v2 sibling).
6. If output shape changed (major), update `LLMExtractionResultSchema` in
   `packages/shared/src/schemas/atom.ts` plus `extraction.ts`
   normalization, and bump the migration if `Atom.content` shape moves.
7. Commit with `feat(worker): extract-atom prompt vX.Y.Z`.

## Decision Log

Append-only. Newest entries on top.

### 2026-05-29: Phase 7 prompt v1

- Model: `claude-haiku-4-5` (~$1 in / $5 out per M, ~4x cheaper than Sonnet 4.5).
- Cost cap per asset: 0.15 USD. Estimate via `chars/4 * 8.5 / 1M` before any
  Claude call; over cap -> Asset.status = FAILED, no Claude call.
- Output: tool_use forced (`submit_atoms`), non-streaming.
- `max_tokens` 8000, `temperature` 0 (deterministic extraction).
- Chunking: text over 30_000 chars splits into 12_000-char chunks with
  500-char overlap on paragraph boundaries.
- Few-shot: 2 examples (English CV + Vietnamese CV) with mixed confidence
  (0.7 to 0.97) to calibrate against confidence inflation.
- Evidence verification: byte-exact match `parsedText.slice(start,end) ===
  snippet`. Any mismatch -> atom rejected, never persisted.

### 2026-05-29: Phase 7 atom model alignment

- AtomKind stays UPPERCASE (8 values, Phase 1 schema). LLM lowercase or
  `role` is normalized to UPPERCASE / `RESPONSIBILITY` in
  `extraction.ts` before validation.
- Content stays as Phase 1 discriminated union per kind. LLM does NOT
  emit a flat string; it emits the per-kind object and worker re-
  validates against `AtomContentSchema`.
- EvidenceSpan stays `{ assetId, startOffset, endOffset, snippet }`. The
  worker fills `assetId`; LLM emits the other three.
- Low confidence atoms (`confidence < 0.4`) still persist with
  `isVerified = false`. No new `status` column.
- New columns added in 20260529100000_add_extraction_fields:
  `Asset.extractionCostUsd`, `Asset.extractedAt`, `Asset.atomCount`,
  `Atom.promptVersion`.
- AssetStatus flow Phase 7: `PARSED -> EXTRACTING -> COMPLETED` (or
  `FAILED` on PermanentError). No new enum values.
- Audit actions added: `ASSET_EXTRACTING`, `ASSET_EXTRACTED`,
  `ASSET_EXTRACT_FAILED`, `ATOMS_CREATED`.

### Future entries

Format:

```
### YYYY-MM-DD: short title
- Change 1
- Change 2
- Rationale or link to PR
```
