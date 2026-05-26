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

## Key Invariant

Every atom must have an `evidence_span` pointing back to the original asset. Composition must cite `atom_id` for each claim. This ensures traceability and prevents hallucination.

## TODO

- [ ] Detailed sequence diagrams per tier
- [ ] Database schema ER diagram
- [ ] API route documentation
- [ ] Rate limiting and credit system flow
- [ ] Deployment architecture diagram
