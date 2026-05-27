# Atom Schema

## What is an atom?

An atom is the smallest reusable unit of a user's career evidence. Raw uploads (old CVs, LinkedIn exports, audio notes, certificates) are decomposed into atoms of one of these kinds:

| Kind             | Meaning                                       |
| ---------------- | --------------------------------------------- |
| `SKILL`          | A capability, optionally with level and years |
| `EXPERIENCE`     | A role at a company over a period             |
| `EDUCATION`      | A degree or program at an institution         |
| `ACHIEVEMENT`    | A measurable accomplishment (prefer a metric) |
| `PROJECT`        | A project with role and technologies          |
| `CERTIFICATION`  | A credential from an issuer                   |
| `LANGUAGE`       | A spoken/written language with proficiency    |
| `RESPONSIBILITY` | An ongoing duty in a role                     |

Each atom carries structured `content` (shape depends on `kind`, see the Zod discriminated union in `@atomic-me/shared`), plus traceability and quality metadata.

## Why evidence_span is mandatory

The core anti-hallucination guarantee: every atom must point back to the exact location in the source asset it was extracted from.

```
evidenceSpan = { assetId, startOffset, endOffset, snippet }
```

This serves three purposes:

1. **Verification**: the user (or a reviewer) can jump to the source and confirm the atom is real.
2. **Anti-fabrication**: the extraction prompt is forced to ground each atom in source text. If a fact is not explicit in the source, the model must drop it rather than invent a span.
3. **Composition integrity**: when generating a CV/cover letter, the system cites `atom_id`s, and each atom is itself backed by an evidence span. The chain is source text -> atom -> generated output.

Manual atoms (created by the user, `assetId = null`) are the only exception to asset-backed evidence, and they are flagged as user-authored.

## Confidence levels

Extraction assigns a `confidence` in `[0, 1]`:

| Range     | Label  | UI treatment                             |
| --------- | ------ | ---------------------------------------- |
| 0.0 - 0.3 | low    | Warning badge, surfaced for review first |
| 0.3 - 0.7 | medium | Neutral badge                            |
| 0.7 - 1.0 | high   | No badge                                 |

All atoms are auto-accepted into the ledger regardless of confidence; confidence only drives UI emphasis and review ordering. The user can verify (`isVerified = true`) or edit any atom.

## Per-kind conventions

- **SKILL** atoms should be canonicalized: `canonicalSkillId` links to a `CanonicalSkill` so duplicates and aliases collapse (e.g. "JS" -> "JavaScript").
- **EXPERIENCE** / **EDUCATION** use ISO date strings; ongoing items use the literal `"present"` for `endDate`.
- **ACHIEVEMENT** should isolate a `metric` when present, since the matcher weights quantified results.
- **PROJECT** lists `technologies` as plain strings (later linkable to canonical skills).

## Vector embedding policy

- **Model**: Voyage AI `voyage-3`.
- **Dimensions**: 1024 (stored as Postgres `vector(1024)` via pgvector).
- **Storage**: the `Atom.embedding` column is declared `Unsupported("vector(1024)")` in Prisma and is nullable. It is populated asynchronously by the worker after extraction, so an atom can exist transiently without an embedding.
- **Normalization**: embeddings are L2-normalized; similarity uses cosine distance.
- **Index**: HNSW with `vector_cosine_ops`, created via raw SQL in the initial migration (Prisma does not manage indexes on `Unsupported` columns).
- **Querying**: vector search runs through `$queryRaw` in the repository layer (a later phase), never through the typed Prisma Client.
