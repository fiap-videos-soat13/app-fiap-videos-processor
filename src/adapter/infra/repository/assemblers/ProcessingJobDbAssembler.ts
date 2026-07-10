import { ProcessingJob } from '@domain/entities/ProcessingJob';
import type { ProcessingJobStatus } from '@domain/enums/ProcessingJobStatus';
import type { processingJobs } from '@adapter/infra/database/schema/processingJobs';

type DbProcessingJob = typeof processingJobs.$inferSelect;

export class ProcessingJobDbAssembler {
  static toDomain(row: DbProcessingJob): ProcessingJob {
    return new ProcessingJob(
      row.id,
      row.userId,
      row.userEmail,
      row.originalFileName,
      row.storageKey,
      row.status as ProcessingJobStatus,
      row.zipStorageKey,
      row.errorMessage,
      row.correlationId,
      row.createdAt,
      row.updatedAt,
      row.completedAt,
    );
  }
}
