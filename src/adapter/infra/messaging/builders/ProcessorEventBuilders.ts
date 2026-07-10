import { randomUUID } from 'node:crypto';
import type { ProcessingJob } from '@domain/entities/ProcessingJob';
import {
  VideoProcessingCompletedEventPort,
  VideoProcessingFailedEventPort,
} from '@domain/outboundPorts/ProcessorEventPorts';
import {
  VideoEventType,
  SCHEMA_VERSION,
  type VideoEventEnvelope,
} from '@validators/VideoEventEnvelopeValidator';

export class VideoProcessingCompletedEnvelopeBuilder extends VideoProcessingCompletedEventPort {
  buildEnvelope(job: ProcessingJob): VideoEventEnvelope {
    const now = new Date().toISOString();
    return {
      eventId: randomUUID(),
      correlationId: job.correlationId,
      workflowId: job.correlationId,
      videoJobId: job.id,
      eventType: VideoEventType.VideoProcessingCompleted,
      occurredAt: now,
      schemaVersion: SCHEMA_VERSION[VideoEventType.VideoProcessingCompleted],
      payload: {
        userId: job.userId,
        userEmail: job.userEmail,
        originalFileName: job.originalFileName,
        zipStorageKey: job.zipStorageKey ?? '',
        completedAt: now,
      },
    };
  }
}

export class VideoProcessingFailedEnvelopeBuilder extends VideoProcessingFailedEventPort {
  buildEnvelope(
    job: ProcessingJob,
    userEmail: string,
    errorMessage: string,
  ): VideoEventEnvelope {
    const now = new Date().toISOString();
    return {
      eventId: randomUUID(),
      correlationId: job.correlationId,
      workflowId: job.correlationId,
      videoJobId: job.id,
      eventType: VideoEventType.VideoProcessingFailed,
      occurredAt: now,
      schemaVersion: SCHEMA_VERSION[VideoEventType.VideoProcessingFailed],
      payload: {
        userId: job.userId,
        userEmail,
        errorMessage,
        failedAt: now,
      },
    };
  }
}
