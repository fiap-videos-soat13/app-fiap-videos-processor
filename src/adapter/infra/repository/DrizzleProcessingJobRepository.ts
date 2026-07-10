import { eq } from 'drizzle-orm';
import { getDb } from '@adapter/infra/database/client';
import { processingJobs, outbox } from '@adapter/infra/database/schema';
import {
  ProcessingJobRepository,
  type EnsureProcessingJobInput,
  type OnProcessingJobUpdatedHook,
} from '@domain/repositories/ProcessingJobRepository';
import { ProcessingJobStatus } from '@domain/enums/ProcessingJobStatus';
import type { ProcessingJobStatus as Status } from '@domain/enums/ProcessingJobStatus';
import type { VideoEventEnvelope } from '@validators/VideoEventEnvelopeValidator';
import { ProcessingJobDbAssembler } from '@adapter/infra/repository/assemblers/ProcessingJobDbAssembler';
import type { ProcessingJob } from '@domain/entities/ProcessingJob';

export class DrizzleProcessingJobRepository extends ProcessingJobRepository {
  async findById(id: string): Promise<ProcessingJob | null> {
    const [row] = await getDb()
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, id))
      .limit(1);
    return row ? ProcessingJobDbAssembler.toDomain(row) : null;
  }

  async ensureJob(input: EnsureProcessingJobInput): Promise<ProcessingJob> {
    const existing = await this.findById(input.id);
    if (existing) {
      return existing;
    }

    const [row] = await getDb()
      .insert(processingJobs)
      .values({
        id: input.id,
        userId: input.userId,
        userEmail: input.userEmail,
        originalFileName: input.originalFileName,
        storageKey: input.storageKey,
        correlationId: input.correlationId,
        status: ProcessingJobStatus.Pending,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create processing job');
    }
    return ProcessingJobDbAssembler.toDomain(row);
  }

  async updateStatusWithOutbox(
    jobId: string,
    status: Status,
    patch: {
      zipStorageKey?: string | null;
      errorMessage?: string | null;
      completedAt?: Date | null;
    },
    onUpdated?: OnProcessingJobUpdatedHook,
  ): Promise<ProcessingJob | null> {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(processingJobs)
        .set({
          status,
          zipStorageKey: patch.zipStorageKey,
          errorMessage: patch.errorMessage,
          completedAt: patch.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId))
        .returning();

      if (!row) {
        return null;
      }

      const job = ProcessingJobDbAssembler.toDomain(row);
      if (onUpdated) {
        await onUpdated(job, async (envelope: VideoEventEnvelope) => {
          await tx.insert(outbox).values({
            id: envelope.eventId,
            aggregateType: 'ProcessingJob',
            aggregateId: job.id,
            eventType: envelope.eventType,
            payload: envelope,
            occurredAt: new Date(envelope.occurredAt),
            publishedAt: null,
            attempts: 0,
            lastError: null,
          });
        });
      }

      return job;
    });
  }
}
