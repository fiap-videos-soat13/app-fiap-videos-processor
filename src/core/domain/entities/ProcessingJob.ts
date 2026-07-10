import type { ProcessingJobStatus } from '@domain/enums/ProcessingJobStatus';

export class ProcessingJob {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly userEmail: string,
    public readonly originalFileName: string,
    public readonly storageKey: string,
    public status: ProcessingJobStatus,
    public zipStorageKey: string | null,
    public errorMessage: string | null,
    public readonly correlationId: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public completedAt: Date | null,
  ) {}
}
