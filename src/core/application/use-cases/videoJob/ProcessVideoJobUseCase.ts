import { ProcessingJobStatus } from '@domain/enums/ProcessingJobStatus';
import { ProcessingJobRepository } from '@domain/repositories/ProcessingJobRepository';
import { VideoFrameExtractor } from '@domain/services/VideoFrameExtractor';
import { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';
import { LoggerService } from '@domain/services/LoggerService';
import {
  VideoProcessingCompletedEventPort,
  VideoProcessingFailedEventPort,
  VideoProcessingStartedEventPort,
} from '@domain/outboundPorts/ProcessorEventPorts';

export type ProcessVideoInput = {
  videoJobId: string;
  userId: string;
  userEmail: string;
  originalFileName: string;
  storageKey: string;
  correlationId: string;
};

export class ProcessVideoJobUseCase {
  constructor(
    private readonly jobs: ProcessingJobRepository,
    private readonly storage: VideoStoragePort,
    private readonly extractor: VideoFrameExtractor,
    private readonly completedEvents: VideoProcessingCompletedEventPort,
    private readonly startedEvents: VideoProcessingStartedEventPort,
    private readonly failedEvents: VideoProcessingFailedEventPort,
    private readonly logger: LoggerService,
  ) {}

  async execute(input: ProcessVideoInput): Promise<void> {
    const job = await this.jobs.ensureJob({
      id: input.videoJobId,
      userId: input.userId,
      userEmail: input.userEmail,
      originalFileName: input.originalFileName,
      storageKey: input.storageKey,
      correlationId: input.correlationId,
    });

    if (job.status === ProcessingJobStatus.Completed) {
      this.logger.log('Job já processado — idempotente', {
        videoJobId: job.id,
      });
      return;
    }

    await this.jobs.updateStatusWithOutbox(
      job.id,
      ProcessingJobStatus.Processing,
      {},
      async (updated, emit) => {
        const envelope = this.startedEvents.buildEnvelope(updated);
        await emit(envelope);
      },
    );

    const videoPath = this.storage.resolveVideoPath(input.storageKey);
    const { zipStorageKey, fullPath } = this.storage.buildZipPath(job.id);

    try {
      await this.extractor.extractFramesToZip(videoPath, fullPath);

      await this.jobs.updateStatusWithOutbox(
        job.id,
        ProcessingJobStatus.Completed,
        {
          zipStorageKey,
          errorMessage: null,
          completedAt: new Date(),
        },
        async (updated, emit) => {
          const envelope = this.completedEvents.buildEnvelope(updated);
          await emit(envelope);
        },
      );

      this.logger.log('Processamento concluído', { videoJobId: job.id });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha no processamento';

      await this.jobs.updateStatusWithOutbox(
        job.id,
        ProcessingJobStatus.Failed,
        {
          errorMessage: message,
          completedAt: null,
        },
        async (updated, emit) => {
          const envelope = this.failedEvents.buildEnvelope(
            updated,
            input.userEmail,
            message,
          );
          await emit(envelope);
        },
      );

      this.logger.error('Processamento falhou', {
        videoJobId: job.id,
        error: message,
      });
    }
  }
}
