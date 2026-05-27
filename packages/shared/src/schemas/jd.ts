import { z } from 'zod';

import { MAX_JD_LENGTH_CHARS } from '../constants/limits.js';

import { AtomKindSchema } from './atom.js';

/**
 * Muc do quan trong cua mot requirement trong JD.
 */
export const JDRequirementImportanceSchema = z.enum(['must', 'nice']);
export type JDRequirementImportance = z.infer<typeof JDRequirementImportanceSchema>;

/**
 * Mot requirement trich tu JD, dang atom-like de matcher so khop voi user atoms.
 */
export const JDRequirementSchema = z.object({
  kind: AtomKindSchema,
  content: z.string().min(1),
  importance: JDRequirementImportanceSchema,
});
export type JDRequirement = z.infer<typeof JDRequirementSchema>;

/**
 * Trang thai parse JD. Khop 1-1 voi enum JDStatus trong Prisma schema.
 */
export const JDStatusSchema = z.enum(['PARSING', 'PARSED', 'FAILED']);
export type JDStatus = z.infer<typeof JDStatusSchema>;

/**
 * Ket qua parse JD: metadata + danh sach requirement.
 */
export const JDParseResultSchema = z.object({
  companyName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  requirements: z.array(JDRequirementSchema),
});
export type JDParseResult = z.infer<typeof JDParseResultSchema>;

/**
 * Input khi user paste JD moi.
 */
export const JDCreateInputSchema = z.object({
  userId: z.string(),
  rawText: z.string().min(1).max(MAX_JD_LENGTH_CHARS),
});
export type JDCreateInput = z.infer<typeof JDCreateInputSchema>;
