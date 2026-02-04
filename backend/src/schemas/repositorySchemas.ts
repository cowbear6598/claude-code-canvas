import { z } from 'zod';
import { requestIdSchema, positionSchema, canvasIdSchema } from './base.js';

const RESERVED_NAMES = ['.git', 'HEAD', 'FETCH_HEAD', 'ORIG_HEAD', 'MERGE_HEAD', 'CHERRY_PICK_HEAD'];

function isValidGitUrl(url: string): boolean {
  const gitUrlPattern = /^(https?:\/\/|git@|git:\/\/).+/;
  return gitUrlPattern.test(url);
}

export const repositoryListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const repositoryCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Repository name must contain only alphanumeric characters, underscores, and hyphens'),
});

export const repositoryNoteCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  repositoryId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const repositoryNoteListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const repositoryNoteUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
  x: z.number().optional(),
  y: z.number().optional(),
  boundToPodId: z.uuid().nullable().optional(),
  originalPosition: positionSchema.nullable().optional(),
});

export const repositoryNoteDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
});

export const podBindRepositorySchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: z.uuid(),
  repositoryId: z.string(),
});

export const podUnbindRepositorySchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: z.uuid(),
});

export const repositoryDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  repositoryId: z.string(),
});

export const repositoryGitCloneSchema = z.object({
  requestId: requestIdSchema,
  repoUrl: z.string().min(1).refine(isValidGitUrl, {
    message: 'Invalid Git repository URL',
  }),
  branch: z.string().optional(),
});

export const repositoryCheckGitSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  repositoryId: z.string(),
});

export const repositoryWorktreeCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  repositoryId: z.string(),
  worktreeName: z
    .string()
    .min(1, 'Worktree 名稱不可為空')
    .max(100, 'Worktree 名稱過長')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Worktree 名稱只能包含英文字母、數字、底線和連字號')
    .refine(
      (name) => !RESERVED_NAMES.includes(name.toLowerCase()),
      'Worktree 名稱不可使用保留名稱'
    ),
});

export const repositoryGetLocalBranchesSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  repositoryId: z.string(),
});

export const repositoryCheckDirtySchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  repositoryId: z.string(),
});

export const repositoryCheckoutBranchSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  repositoryId: z.string(),
  branchName: z.string().regex(/^[a-zA-Z0-9_\-/]+$/, '分支名稱只能包含英文字母、數字、底線、連字號和斜線'),
  force: z.boolean().default(false),
});

export const repositoryDeleteBranchSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  repositoryId: z.string(),
  branchName: z.string().regex(/^[a-zA-Z0-9_\-/]+$/, '分支名稱只能包含英文字母、數字、底線、連字號和斜線'),
  force: z.boolean().default(false),
});

export type RepositoryListPayload = z.infer<typeof repositoryListSchema>;
export type RepositoryCreatePayload = z.infer<typeof repositoryCreateSchema>;
export type PodBindRepositoryPayload = z.infer<typeof podBindRepositorySchema>;
export type PodUnbindRepositoryPayload = z.infer<typeof podUnbindRepositorySchema>;
export type RepositoryDeletePayload = z.infer<typeof repositoryDeleteSchema>;
export type RepositoryGitClonePayload = z.infer<typeof repositoryGitCloneSchema>;
export type RepositoryCheckGitPayload = z.infer<typeof repositoryCheckGitSchema>;
export type RepositoryWorktreeCreatePayload = z.infer<typeof repositoryWorktreeCreateSchema>;
export type RepositoryNoteCreatePayload = z.infer<typeof repositoryNoteCreateSchema>;
export type RepositoryNoteListPayload = z.infer<typeof repositoryNoteListSchema>;
export type RepositoryNoteUpdatePayload = z.infer<typeof repositoryNoteUpdateSchema>;
export type RepositoryNoteDeletePayload = z.infer<typeof repositoryNoteDeleteSchema>;
export type RepositoryGetLocalBranchesPayload = z.infer<typeof repositoryGetLocalBranchesSchema>;
export type RepositoryCheckDirtyPayload = z.infer<typeof repositoryCheckDirtySchema>;
export type RepositoryCheckoutBranchPayload = z.infer<typeof repositoryCheckoutBranchSchema>;
export type RepositoryDeleteBranchPayload = z.infer<typeof repositoryDeleteBranchSchema>;
