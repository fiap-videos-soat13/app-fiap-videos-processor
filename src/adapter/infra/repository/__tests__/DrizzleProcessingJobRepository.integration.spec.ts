import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DrizzleProcessingJobRepository } from '../DrizzleProcessingJobRepository';
import { ProcessingJobStatus } from '@domain/enums/ProcessingJobStatus';
import { VideoEventType } from '@validators/VideoEventEnvelopeValidator';
import type { VideoEventEnvelope } from '@validators/VideoEventEnvelopeValidator';
import type { EnsureProcessingJobInput } from '@domain/repositories/ProcessingJobRepository';
import { getDb } from '@adapter/infra/database/client';
import { outbox, processingJobs } from '@adapter/infra/database/schema';

function buildInput(overrides?: Partial<EnsureProcessingJobInput>): EnsureProcessingJobInput {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    userEmail: 'integration@fiap.local',
    originalFileName: 'video.mp4',
    storageKey: 'videos/job-video.mp4',
    correlationId: randomUUID(),
    ...overrides,
  };
}

describe('DrizzleProcessingJobRepository integration', () => {
  const repository = new DrizzleProcessingJobRepository();

  it('creates a job with pending status', async () => {
    const input = buildInput();

    const job = await repository.ensureJob(input);

    expect(job.id).toBe(input.id);
    expect(job.userId).toBe(input.userId);
    expect(job.userEmail).toBe(input.userEmail);
    expect(job.originalFileName).toBe(input.originalFileName);
    expect(job.storageKey).toBe(input.storageKey);
    expect(job.correlationId).toBe(input.correlationId);
    expect(job.status).toBe(ProcessingJobStatus.Pending);
    expect(job.zipStorageKey).toBeNull();
    expect(job.errorMessage).toBeNull();
    expect(job.completedAt).toBeNull();
  });

  it('is idempotent: ensureJob returns the existing job for the same id', async () => {
    const input = buildInput();

    const first = await repository.ensureJob(input);
    const second = await repository.ensureJob({
      ...input,
      originalFileName: 'changed.mp4',
    });

    expect(second.id).toBe(first.id);
    expect(second.originalFileName).toBe('video.mp4');

    const rows = await getDb()
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, input.id));
    expect(rows).toHaveLength(1);
  });

  it('finds a job by id and returns null when it does not exist', async () => {
    const input = buildInput();
    await repository.ensureJob(input);

    const found = await repository.findById(input.id);
    expect(found).not.toBeNull();
    expect(found?.correlationId).toBe(input.correlationId);

    const missing = await repository.findById(randomUUID());
    expect(missing).toBeNull();
  });

  it('transitions pending -> processing -> completed', async () => {
    const input = buildInput();
    await repository.ensureJob(input);

    const processing = await repository.updateStatusWithOutbox(
      input.id,
      ProcessingJobStatus.Processing,
      {},
    );
    expect(processing?.status).toBe(ProcessingJobStatus.Processing);
    expect(processing?.completedAt).toBeNull();

    const completedAt = new Date();
    const completed = await repository.updateStatusWithOutbox(
      input.id,
      ProcessingJobStatus.Completed,
      { zipStorageKey: 'zips/job-video.zip', completedAt },
    );
    expect(completed?.status).toBe(ProcessingJobStatus.Completed);
    expect(completed?.zipStorageKey).toBe('zips/job-video.zip');
    expect(completed?.completedAt).not.toBeNull();

    const persisted = await repository.findById(input.id);
    expect(persisted?.status).toBe(ProcessingJobStatus.Completed);
    expect(persisted?.zipStorageKey).toBe('zips/job-video.zip');
  });

  it('transitions to failed with an error message', async () => {
    const input = buildInput();
    await repository.ensureJob(input);

    const failed = await repository.updateStatusWithOutbox(
      input.id,
      ProcessingJobStatus.Failed,
      { errorMessage: 'codec error' },
    );

    expect(failed?.status).toBe(ProcessingJobStatus.Failed);
    expect(failed?.errorMessage).toBe('codec error');

    const persisted = await repository.findById(input.id);
    expect(persisted?.status).toBe(ProcessingJobStatus.Failed);
    expect(persisted?.errorMessage).toBe('codec error');
  });

  it('returns null when updating a job that does not exist', async () => {
    const result = await repository.updateStatusWithOutbox(
      randomUUID(),
      ProcessingJobStatus.Processing,
      {},
    );

    expect(result).toBeNull();
  });

  it('persists an outbox row when the onUpdated hook emits an envelope', async () => {
    const input = buildInput();
    await repository.ensureJob(input);

    const envelope: VideoEventEnvelope = {
      eventId: randomUUID(),
      correlationId: input.correlationId,
      workflowId: randomUUID(),
      videoJobId: input.id,
      eventType: VideoEventType.VideoProcessingCompleted,
      occurredAt: new Date().toISOString(),
      schemaVersion: 1,
      payload: {
        userId: input.userId,
        userEmail: input.userEmail,
        originalFileName: input.originalFileName,
        zipStorageKey: 'zips/job-video.zip',
        completedAt: new Date().toISOString(),
      },
    };

    const job = await repository.updateStatusWithOutbox(
      input.id,
      ProcessingJobStatus.Completed,
      { zipStorageKey: 'zips/job-video.zip', completedAt: new Date() },
      async (_job, emit) => {
        await emit(envelope);
      },
    );

    const rows = await getDb()
      .select()
      .from(outbox)
      .where(eq(outbox.aggregateId, job!.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(envelope.eventId);
    expect(rows[0].aggregateType).toBe('ProcessingJob');
    expect(rows[0].eventType).toBe(VideoEventType.VideoProcessingCompleted);
    expect(rows[0].publishedAt).toBeNull();
    expect(rows[0].attempts).toBe(0);
  });

  it('writes no outbox row when the hook is not provided', async () => {
    const input = buildInput();
    await repository.ensureJob(input);

    await repository.updateStatusWithOutbox(
      input.id,
      ProcessingJobStatus.Processing,
      {},
    );

    const rows = await getDb()
      .select()
      .from(outbox)
      .where(eq(outbox.aggregateId, input.id));

    expect(rows).toHaveLength(0);
  });
});
