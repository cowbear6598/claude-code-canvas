import { z } from 'zod';

export const slackAppCreateSchema = z.object({
  name: z.string().min(1).max(100),
  botToken: z.string().startsWith('xoxb-'),
  appToken: z.string().startsWith('xapp-'),
});

const slackAppIdOnlySchema = z.object({
  slackAppId: z.string().uuid(),
});

export const slackAppDeleteSchema = slackAppIdOnlySchema;
export const slackAppGetSchema = slackAppIdOnlySchema;
export const slackAppChannelsSchema = slackAppIdOnlySchema;
export const slackAppChannelsRefreshSchema = slackAppIdOnlySchema;

export const podBindSlackSchema = z.object({
  canvasId: z.string(),
  podId: z.string(),
  slackAppId: z.string().uuid(),
  slackChannelId: z.string().min(1),
});

export const podUnbindSlackSchema = z.object({
  canvasId: z.string(),
  podId: z.string(),
});

export type SlackAppCreatePayload = z.infer<typeof slackAppCreateSchema>;
export type SlackAppDeletePayload = z.infer<typeof slackAppDeleteSchema>;
export type SlackAppGetPayload = z.infer<typeof slackAppGetSchema>;
export type SlackAppChannelsPayload = z.infer<typeof slackAppChannelsSchema>;
export type SlackAppChannelsRefreshPayload = z.infer<typeof slackAppChannelsRefreshSchema>;
export type PodBindSlackPayload = z.infer<typeof podBindSlackSchema>;
export type PodUnbindSlackPayload = z.infer<typeof podUnbindSlackSchema>;
