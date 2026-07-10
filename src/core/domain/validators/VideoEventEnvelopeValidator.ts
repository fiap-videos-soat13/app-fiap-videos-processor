/**
 * Contrato de eventos (cópia local por microsserviço).
 * Fonte canônica no workspace: docs/contracts/VideoEventEnvelopeValidator.ts
 */
import { z } from 'zod';

export const VideoEventType = {
  VideoProcessingRequested: 'VideoProcessingRequested',
  VideoProcessingCompleted: 'VideoProcessingCompleted',
  VideoProcessingFailed: 'VideoProcessingFailed',
} as const;

export type VideoEventType =
  (typeof VideoEventType)[keyof typeof VideoEventType];

export const SCHEMA_VERSION = {
  [VideoEventType.VideoProcessingRequested]: 1,
  [VideoEventType.VideoProcessingCompleted]: 1,
  [VideoEventType.VideoProcessingFailed]: 1,
} as const;

const baseEnvelopeFields = {
  eventId: z.uuid(),
  correlationId: z.uuid(),
  workflowId: z.uuid(),
  videoJobId: z.uuid(),
  eventType: z.enum([
    VideoEventType.VideoProcessingRequested,
    VideoEventType.VideoProcessingCompleted,
    VideoEventType.VideoProcessingFailed,
  ]),
  occurredAt: z.iso.datetime(),
  schemaVersion: z.number().int().positive(),
};

export const VideoProcessingRequestedPayloadSchema = z.object({
  userId: z.uuid(),
  userEmail: z.email(),
  originalFileName: z.string().min(1),
  storageKey: z.string().min(1),
});

export const VideoProcessingCompletedPayloadSchema = z.object({
  userId: z.uuid(),
  userEmail: z.email(),
  originalFileName: z.string().min(1),
  zipStorageKey: z.string().min(1),
  completedAt: z.iso.datetime(),
});

export const VideoProcessingFailedPayloadSchema = z.object({
  userId: z.uuid(),
  userEmail: z.email(),
  errorMessage: z.string().min(1),
  failedAt: z.iso.datetime(),
});

export const VideoEventEnvelopeSchema = z.discriminatedUnion('eventType', [
  z.object({
    ...baseEnvelopeFields,
    eventType: z.literal(VideoEventType.VideoProcessingRequested),
    payload: VideoProcessingRequestedPayloadSchema,
  }),
  z.object({
    ...baseEnvelopeFields,
    eventType: z.literal(VideoEventType.VideoProcessingCompleted),
    payload: VideoProcessingCompletedPayloadSchema,
  }),
  z.object({
    ...baseEnvelopeFields,
    eventType: z.literal(VideoEventType.VideoProcessingFailed),
    payload: VideoProcessingFailedPayloadSchema,
  }),
]);

export type VideoEventEnvelope = z.infer<typeof VideoEventEnvelopeSchema>;

export function parseEnvelope(payload: unknown): VideoEventEnvelope {
  return VideoEventEnvelopeSchema.parse(payload);
}
