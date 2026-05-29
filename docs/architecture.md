# Architecture: 4-Tier Pipeline

## Overview

atomic-me transforms career documents into reusable "atoms" that can be recomposed into tailored CVs and cover letters. The system is organized into 4 tiers.

## Tier 1: Ingestion

Frontend gets a presigned URL from API, uploads directly to R2, API receives metadata confirmation, enqueues `parse_asset` job.

## Tier 2: Atomization Pipeline (Worker)

1. Parse file (PDF / DOCX / image / audio / LinkedIn archive zip)
2. LLM extract structured JSON atoms with Zod validation
3. Batch embed via Voyage AI, store in pgvector
4. Dedup: cosine similarity top-K with existing atoms, merge if above threshold
5. Canonicalize: map skills to canonical taxonomy (ESCO subset seed)

## Tier 3: Storage

- **Postgres + pgvector**: relational data and embeddings in single DB
- **Cloudflare R2**: raw assets and exports via presigned URLs
- **Redis**: BullMQ job queue and cache

## Tier 4: Composition (on JD apply)

Parse JD into requirement atoms, semantic retrieval + LLM rerank from user's atom ledger, constrained compose (only cite selected atom_ids), export.

## Background Jobs (Phase 6+)

The worker (`apps/worker`) is a separate Node process that consumes BullMQ
queues backed by Redis. The API (`apps/api`) is the producer; it never
parses files itself.

### Phase 6 pipeline: ingest

```
POST /assets/confirm
  -> asset.status = UPLOADED
  -> fastify.queue.parseAsset.add('parse-asset', { assetId, userId },
                                   { jobId: 'parse:<assetId>' })

parse-asset worker:
  1. load Asset; abort UnrecoverableError if not found / not owned
  2. skip if status already PARSED (idempotent)
  3. status -> PARSING + audit ASSET_PARSING
  4. GET object from R2 (storageKey) into a size-capped Buffer
  5. parserRegistry.getParser(mime, filename) -> FileParser
  6. parser.parse(buffer) -> { text, metadata, warnings }
  7. status -> PARSED, write parsedText / parsedMetadata / parsedAt /
     warnings + audit ASSET_PARSED
  8. enqueue 'extract-atoms' placeholder (Phase 7 worker not yet built)
```

Error handling:
- `PermanentError` from a parser (unsupported file type, corrupt PDF,
  not-a-LinkedIn-zip) sets `status = FAILED`, writes `errorMessage`,
  audits `ASSET_PARSE_FAILED`, throws `UnrecoverableError` so BullMQ
  does not retry.
- Anything else (R2 5xx, DB timeout) only writes `errorMessage` and
  re-throws so BullMQ retries with exponential backoff
  (3 attempts, base delay 2s). Status stays `PARSING` so the next
  attempt resumes from the same state instead of restarting.

### Queues (Phase 6 declared, only `parse-asset` implemented)

| Name              | Producer                  | Worker     |
|-------------------|---------------------------|------------|
| `parse-asset`     | api / parse-asset worker  | Phase 6    |
| `extract-atoms`   | parse-asset worker        | Phase 7    |
| `embed-atoms`     | extract-atoms worker      | Phase 7    |
| `dedup-atoms`     | embed-atoms worker        | Phase 7    |
| `canonicalize`    | dedup-atoms worker        | Phase 8    |
| `cleanup`         | cron                      | Phase n    |

Constants live in `packages/shared/src/constants/queues.ts` so api and
worker reference the same names + default job options
(`attempts: 3`, exponential backoff, `removeOnComplete` after 1d/1000,
`removeOnFail` after 7d).

### Parsers (apps/worker/src/parsers)

- `pdf.parser` uses `unpdf` (modern pdfjs-dist serverless build). Empty
  text returns warning `no extractable text, may need OCR` instead of
  failing, so scanned PDFs can be handled later by OCR.
- `docx.parser` uses `mammoth.extractRawText`.
- `linkedin-archive.parser` reads Profile / Positions / Education /
  Skills / Certifications / Projects CSVs from a LinkedIn export zip;
  missing `Profile.csv` is a `PermanentError`.
- `image.parser` validates with `sharp` metadata; returns empty text +
  a `deferred to extraction phase` warning until Phase 7 calls Claude
  vision.
- `audio.parser` is a stub that always throws `PermanentError` until
  Phase 8 wires Whisper / Files API.

The registry routes on `(mimeType, filename)`; LinkedIn-zip is checked
before generic parsers so `application/zip` lands on the right handler.

## Atomize pipeline (Phase 7)

Builds on the background-jobs section. After `parse-asset` flips an asset
to `PARSED`, it enqueues `extract-atoms` with `jobId = extract:<assetId>`
+ per-job `{ attempts: 3, backoff: { type: 'exponential', delay: 1000 } }`.

```
extract-atoms worker (concurrency 3, BullMQ retry 3 + exp backoff 1s)
  1. load Asset; verify userId; status check (PARSED resume, COMPLETED skip,
     EXTRACTING + atomCount>0 skip, else UnrecoverableError)
  2. empty parsedText -> COMPLETED + ATOMS_CREATED count=0
  3. status -> EXTRACTING + audit ASSET_EXTRACTING
  4. cost gate: estimate from chars * 2.125 / 1M; over EXTRACTION_COST_CAP_USD
     -> FAILED + UnrecoverableError, no Claude call
  5. extractAtomsFromAsset:
       chunk parsedText (12k chars max, 500 char overlap on paragraph
       boundaries) -> for each chunk: traced(anthropic.messages.create with
       tool_choice 'submit_atoms') -> Zod LLMExtractionResultSchema ->
       per atom: normalize kind (UPPERCASE, role -> RESPONSIBILITY),
       absolute offsets, byte-exact snippet verify, strict
       AtomContentSchema discriminated-union validation; cross-chunk
       dedup by (kind, snippet)
  6. $transaction: createMany atoms + Asset.update { status COMPLETED,
     atomCount, extractionCostUsd, extractedAt }
  7. audit ASSET_EXTRACTED + ATOMS_CREATED
```

Error policy mirrors `parse-asset`:

- `PermanentError` (input too large, LLM did not call submit_atoms, bad
  Zod, 400/401/403 from Anthropic, cost cap exceeded) -> status FAILED
  + audit `ASSET_EXTRACT_FAILED` + `UnrecoverableError` (no retry).
- Transient (Anthropic 429 / 5xx / DB timeout) -> write `errorMessage`,
  re-throw so BullMQ retries from `status = EXTRACTING`.

The single $transaction around `createMany` + status flip means a crash
either rolls back both or commits both; restart picks up cleanly.

### Anti-hallucination

Every extracted atom carries `evidenceSpan = { assetId, startOffset,
endOffset, snippet }`. The worker checks
`parsedText.slice(startOffset, endOffset) === snippet` byte-exact. An
atom whose snippet does not match is rejected before it reaches the DB.
This is the same anti-fabrication invariant the rest of the system
relies on for Phase 9 composition.

### Prompt versioning

`Atom.promptVersion` records the exact prompt string that generated the
atom (e.g. `extract-atom@v1.0.0`). New versions go in new files, never
edits to old ones; see `docs/llm-prompts.md` for the policy.

## Key Invariant

Every atom must have an `evidence_span` pointing back to the original asset. Composition must cite `atom_id` for each claim. This ensures traceability and prevents hallucination.

## TODO

- [ ] Detailed sequence diagrams per tier
- [ ] Database schema ER diagram
- [ ] API route documentation
- [ ] Rate limiting and credit system flow
- [ ] Deployment architecture diagram
