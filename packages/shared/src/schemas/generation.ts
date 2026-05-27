import { z } from 'zod';

/**
 * Loai generation. Khop 1-1 voi enum GenerationType trong Prisma schema.
 */
export const GenerationTypeSchema = z.enum(['CV', 'COVER_LETTER']);
export type GenerationType = z.infer<typeof GenerationTypeSchema>;

/** Tone cho output, optional (default professional o service layer). */
export const GenerationToneSchema = z.enum(['professional', 'enthusiastic', 'concise']);
export type GenerationTone = z.infer<typeof GenerationToneSchema>;

/** Mot muc kinh nghiem trong CV output. */
export const CVExperienceItemSchema = z.object({
  company: z.string(),
  title: z.string(),
  period: z.string(),
  location: z.string().optional(),
  bullets: z.array(z.string()),
});

/** Mot muc hoc van trong CV output. */
export const CVEducationItemSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  period: z.string().optional(),
});

/**
 * CV output da cau truc. `citedAtomIds` ép moi noi dung phai tro ve atom goc.
 */
export const CVOutputSchema = z.object({
  summary: z.string(),
  experiences: z.array(CVExperienceItemSchema),
  skills: z.array(z.string()),
  education: z.array(CVEducationItemSchema),
  certifications: z.array(z.string()).optional(),
  citedAtomIds: z.array(z.string()),
});
export type CVOutput = z.infer<typeof CVOutputSchema>;

/**
 * Cover letter output: cac paragraph + atom da cite.
 */
export const CoverLetterOutputSchema = z.object({
  paragraphs: z.array(z.string()).min(1),
  citedAtomIds: z.array(z.string()),
});
export type CoverLetterOutput = z.infer<typeof CoverLetterOutputSchema>;

/**
 * Request generate CV hoac cover letter tu cac atom da chon.
 */
export const GenerationRequestSchema = z.object({
  jdId: z.string(),
  type: GenerationTypeSchema,
  selectedAtomIds: z.array(z.string()).min(1),
  tone: GenerationToneSchema.optional(),
});
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
