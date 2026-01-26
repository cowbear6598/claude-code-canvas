import { z } from 'zod';
import { requestIdSchema, podIdSchema } from './base.js';

// Simple Git URL validation
const isValidGitUrl = (url: string): boolean => {
  // Basic validation for git URLs (https, git, ssh)
  const gitUrlPattern = /^(https?:\/\/|git@|git:\/\/).+/;
  return gitUrlPattern.test(url);
};

export const gitCloneSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
  repoUrl: z.string().min(1).refine(isValidGitUrl, {
    message: 'Invalid Git repository URL',
  }),
  branch: z.string().optional(),
});

// Inferred types
export type GitClonePayload = z.infer<typeof gitCloneSchema>;
