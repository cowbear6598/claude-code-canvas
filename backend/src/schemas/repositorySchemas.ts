import { z } from 'zod';
import { requestIdSchema, positionSchema } from './base.js';

function isValidGitUrl(url: string): boolean {
  const gitUrlPattern = /^(https?:\/\/|git@|git:\/\/).+/;
  return gitUrlPattern.test(url);
}

export const repositoryListSchema = z.object({
  requestId: requestIdSchema,
});

export const repositoryCreateSchema = z.object({
  requestId: requestIdSchema,
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Repository name must contain only alphanumeric characters, underscores, and hyphens'),
});

export const repositoryNoteCreateSchema = z.object({
  requestId: requestIdSchema,
  repositoryId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const repositoryNoteListSchema = z.object({
  requestId: requestIdSchema,
});

export const repositoryNoteUpdateSchema = z.object({
  requestId: requestIdSchema,
  noteId: z.uuid(),
  x: z.number().optional(),
  y: z.number().optional(),
  boundToPodId: z.uuid().nullable().optional(),
  originalPosition: positionSchema.nullable().optional(),
});

export const repositoryNoteDeleteSchema = z.object({
  requestId: requestIdSchema,
  noteId: z.uuid(),
});

export const podBindRepositorySchema = z.object({
  requestId: requestIdSchema,
  podId: z.uuid(),
  repositoryId: z.string(),
});

export const podUnbindRepositorySchema = z.object({
  requestId: requestIdSchema,
  podId: z.uuid(),
});

export const repositoryDeleteSchema = z.object({
  requestId: requestIdSchema,
  repositoryId: z.string(),
});

export const repositoryGitCloneSchema = z.object({
  requestId: requestIdSchema,
  repoUrl: z.string().min(1).refine(isValidGitUrl, {
    message: 'Invalid Git repository URL',
  }),
  branch: z.string().optional(),
});

export type RepositoryListPayload = z.infer<typeof repositoryListSchema>;
export type RepositoryCreatePayload = z.infer<typeof repositoryCreateSchema>;
export type RepositoryNoteCreatePayload = z.infer<typeof repositoryNoteCreateSchema>;
export type RepositoryNoteListPayload = z.infer<typeof repositoryNoteListSchema>;
export type RepositoryNoteUpdatePayload = z.infer<typeof repositoryNoteUpdateSchema>;
export type RepositoryNoteDeletePayload = z.infer<typeof repositoryNoteDeleteSchema>;
export type PodBindRepositoryPayload = z.infer<typeof podBindRepositorySchema>;
export type PodUnbindRepositoryPayload = z.infer<typeof podUnbindRepositorySchema>;
export type RepositoryDeletePayload = z.infer<typeof repositoryDeleteSchema>;
export type RepositoryGitClonePayload = z.infer<typeof repositoryGitCloneSchema>;
