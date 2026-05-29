import { z } from 'zod';

/**
 * Loai atom. Khop 1-1 voi enum AtomKind trong Prisma schema.
 */
export const AtomKindSchema = z.enum([
  'SKILL',
  'EXPERIENCE',
  'EDUCATION',
  'ACHIEVEMENT',
  'PROJECT',
  'CERTIFICATION',
  'LANGUAGE',
  'RESPONSIBILITY',
]);
export type AtomKind = z.infer<typeof AtomKindSchema>;

/**
 * Evidence span: tro ve doan text trong asset goc da sinh ra atom.
 * Bat buoc cho moi atom de chong hallucination (xem docs/atom-schema.md).
 */
export const EvidenceSpanSchema = z.object({
  assetId: z.string(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  snippet: z.string(),
});
export type EvidenceSpan = z.infer<typeof EvidenceSpanSchema>;

/** Muc do thanh thao cho atom kind=SKILL. */
export const SkillLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']);

/** Content cho atom SKILL. */
export const SkillContentSchema = z.object({
  kind: z.literal('SKILL'),
  name: z.string().min(1),
  level: SkillLevelSchema.optional(),
  yearsOfExperience: z.number().nonnegative().optional(),
});

/** Content cho atom EXPERIENCE. endDate = "present" neu dang lam. */
export const ExperienceContentSchema = z.object({
  kind: z.literal('EXPERIENCE'),
  company: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string(),
  endDate: z.union([z.string(), z.literal('present')]),
  description: z.string(),
  location: z.string().optional(),
});

/** Content cho atom EDUCATION. */
export const EducationContentSchema = z.object({
  kind: z.literal('EDUCATION'),
  institution: z.string().min(1),
  degree: z.string(),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.union([z.string(), z.literal('present')]).optional(),
  gpa: z.string().optional(),
});

/** Content cho atom ACHIEVEMENT. metric tach rieng de matcher uu tien. */
export const AchievementContentSchema = z.object({
  kind: z.literal('ACHIEVEMENT'),
  description: z.string().min(1),
  metric: z.string().optional(),
  date: z.string().optional(),
});

/** Content cho atom PROJECT. */
export const ProjectContentSchema = z.object({
  kind: z.literal('PROJECT'),
  name: z.string().min(1),
  description: z.string(),
  role: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  url: z.string().url().optional(),
});

/** Content cho atom CERTIFICATION. */
export const CertificationContentSchema = z.object({
  kind: z.literal('CERTIFICATION'),
  name: z.string().min(1),
  issuer: z.string(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  credentialId: z.string().optional(),
});

/** Content cho atom LANGUAGE. proficiency theo thang CEFR-like. */
export const LanguageContentSchema = z.object({
  kind: z.literal('LANGUAGE'),
  language: z.string().min(1),
  proficiency: z.enum(['BASIC', 'CONVERSATIONAL', 'PROFESSIONAL', 'NATIVE']).optional(),
});

/** Content cho atom RESPONSIBILITY. */
export const ResponsibilityContentSchema = z.object({
  kind: z.literal('RESPONSIBILITY'),
  description: z.string().min(1),
  context: z.string().optional(),
});

/**
 * Discriminated union cho content theo `kind`. Mỗi kind có shape rieng.
 */
export const AtomContentSchema = z.discriminatedUnion('kind', [
  SkillContentSchema,
  ExperienceContentSchema,
  EducationContentSchema,
  AchievementContentSchema,
  ProjectContentSchema,
  CertificationContentSchema,
  LanguageContentSchema,
  ResponsibilityContentSchema,
]);
export type AtomContent = z.infer<typeof AtomContentSchema>;

/**
 * Full atom shape, khop voi DB model nhung khong gom `embedding`
 * (embedding la vector pgvector, xu ly o repository layer).
 */
export const AtomSchema = z.object({
  id: z.string(),
  userId: z.string(),
  assetId: z.string().nullable(),
  kind: AtomKindSchema,
  content: AtomContentSchema,
  evidenceSpan: EvidenceSpanSchema,
  confidence: z.number().min(0).max(1),
  canonicalSkillId: z.string().nullable(),
  isVerified: z.boolean(),
  mergedIntoId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Atom = z.infer<typeof AtomSchema>;

/**
 * Input khi tao atom moi. Cac field server tu set (id, timestamps,
 * isVerified, mergedIntoId) bi loai bo.
 */
export const AtomCreateInputSchema = z.object({
  userId: z.string(),
  assetId: z.string().nullable(),
  kind: AtomKindSchema,
  content: AtomContentSchema,
  evidenceSpan: EvidenceSpanSchema,
  confidence: z.number().min(0).max(1),
  canonicalSkillId: z.string().nullable().optional(),
});
export type AtomCreateInput = z.infer<typeof AtomCreateInputSchema>;

/**
 * Input khi user edit atom. Tat ca field deu optional (partial update).
 */
export const AtomUpdateInputSchema = z.object({
  content: AtomContentSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  canonicalSkillId: z.string().nullable().optional(),
  isVerified: z.boolean().optional(),
});
export type AtomUpdateInput = z.infer<typeof AtomUpdateInputSchema>;

// ============================================================
// Phase 7: LLM extraction shapes
// ============================================================

/**
 * Shape LLM emit (truoc khi worker normalize sang AtomCreateInput).
 *
 * Khac AtomCreateInput o cho:
 * - kind co the lowercase (worker UPPERCASE hoa); cho phep 'role' -> map sang RESPONSIBILITY.
 * - evidenceSpan KHONG co assetId (worker tu fill); chi co startOffset/endOffset/snippet.
 * - content: discriminated union sau khi normalize kind. Vi LLM co the typo
 *   kind/content, worker re-validate qua AtomContentSchema sau khi UPPERCASE hoa.
 *
 * Validation kep: schema nay accept rong rai (loose), AtomContentSchema strict.
 */
export const LLMEvidenceSpanSchema = z.object({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  snippet: z.string().min(1),
});

/** Kind LLM tra (case-insensitive + co the la 'role'). Worker normalize sau. */
export const LLMAtomKindSchema = z.string().min(1);

export const LLMExtractionAtomSchema = z.object({
  kind: LLMAtomKindSchema,
  /**
   * Content shape phu thuoc kind sau khi UPPERCASE hoa, validate o worker.
   * Cho z.record(z.unknown()) o schema LLM de khong reject early khi key sai vi case.
   */
  content: z.record(z.unknown()),
  evidenceSpan: LLMEvidenceSpanSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(2000).optional(),
});
export type LLMExtractionAtom = z.infer<typeof LLMExtractionAtomSchema>;

export const LLMExtractionResultSchema = z.object({
  atoms: z.array(LLMExtractionAtomSchema),
  /** ISO 639-1 2-letter code (vd 'en', 'vi'). */
  sourceLanguage: z.string().length(2),
  extractionNotes: z.string().nullable().optional(),
});
export type LLMExtractionResult = z.infer<typeof LLMExtractionResultSchema>;
