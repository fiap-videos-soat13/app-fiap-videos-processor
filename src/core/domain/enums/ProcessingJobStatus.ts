export const ProcessingJobStatus = {
  Pending: 'pending',
  Processing: 'processing',
  Completed: 'completed',
  Failed: 'failed',
} as const;

export type ProcessingJobStatus =
  (typeof ProcessingJobStatus)[keyof typeof ProcessingJobStatus];
