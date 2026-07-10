import type { ProcessingJob } from '@domain/entities/ProcessingJob';
import type { ProcessingJobStatus } from '@domain/enums/ProcessingJobStatus';
import type { VideoEventEnvelope } from '@validators/VideoEventEnvelopeValidator';

export type OnProcessingJobUpdatedHook = (
  job: ProcessingJob,
  emit: (envelope: VideoEventEnvelope) => Promise<void>,
) => Promise<void>;

export type EnsureProcessingJobInput = {
  id: string;
  userId: string;
  userEmail: string;
  originalFileName: string;
  storageKey: string;
  correlationId: string;
};

export abstract class ProcessingJobRepository {
  abstract findById(id: string): Promise<ProcessingJob | null>;

  abstract ensureJob(input: EnsureProcessingJobInput): Promise<ProcessingJob>;

  abstract updateStatusWithOutbox(
    jobId: string,
    status: ProcessingJobStatus,
    patch: {
      zipStorageKey?: string | null;
      errorMessage?: string | null;
      completedAt?: Date | null;
    },
    onUpdated?: OnProcessingJobUpdatedHook,
  ): Promise<ProcessingJob | null>;
}
