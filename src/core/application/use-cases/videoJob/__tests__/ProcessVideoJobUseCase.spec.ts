import { ProcessVideoJobUseCase } from '@use-cases/videoJob/ProcessVideoJobUseCase';
import { ProcessingJob } from '@domain/entities/ProcessingJob';
import { ProcessingJobStatus } from '@domain/enums/ProcessingJobStatus';
import type { ProcessingJobRepository } from '@domain/repositories/ProcessingJobRepository';
import type { VideoFrameExtractor } from '@domain/services/VideoFrameExtractor';
import type { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';
import type { LoggerService } from '@domain/services/LoggerService';

function makeJob(status: ProcessingJobStatus = ProcessingJobStatus.Pending): ProcessingJob {
  const now = new Date();
  return new ProcessingJob(
    'job-id',
    'user-id',
    'user@fiap.com',
    'video.mp4',
    'videos/job-id-video.mp4',
    status,
    null,
    null,
    'corr-id',
    now,
    now,
    null,
  );
}

describe('ProcessVideoJobUseCase', () => {
  let jobs: jest.Mocked<ProcessingJobRepository>;
  let storage: jest.Mocked<VideoStoragePort>;
  let extractor: jest.Mocked<VideoFrameExtractor>;
  let completedEvents: { buildEnvelope: jest.Mock };
  let startedEvents: { buildEnvelope: jest.Mock };
  let failedEvents: { buildEnvelope: jest.Mock };
  let logger: jest.Mocked<LoggerService>;
  let useCase: ProcessVideoJobUseCase;

  beforeEach(() => {
    jobs = {
      findById: jest.fn(),
      ensureJob: jest.fn().mockResolvedValue(makeJob()),
      updateStatusWithOutbox: jest.fn().mockImplementation(async (
        _jobId: string,
        status: ProcessingJobStatus,
        patch: unknown,
        onUpdated?: (job: ProcessingJob, emit: (envelope: unknown) => Promise<void>) => Promise<void>,
      ) => {
        const job = makeJob(status);
        Object.assign(job, patch);
        if (onUpdated) {
          await onUpdated(job, jest.fn());
        }
        return job;
      }),
    };
    storage = {
      resolveVideoPath: jest.fn().mockReturnValue('/storage/videos/job-id-video.mp4'),
      buildZipPath: jest.fn().mockReturnValue({
        zipStorageKey: 'zips/job-id.zip',
        fullPath: '/storage/zips/job-id.zip',
      }),
      finalizeZip: jest.fn().mockResolvedValue(undefined),
    };
    extractor = {
      extractFramesToZip: jest.fn().mockResolvedValue(undefined),
    };
    completedEvents = {
      buildEnvelope: jest.fn().mockReturnValue({ type: 'VideoProcessingCompleted' }),
    };
    startedEvents = {
      buildEnvelope: jest.fn().mockReturnValue({ type: 'VideoProcessingStarted' }),
    };
    failedEvents = {
      buildEnvelope: jest.fn().mockReturnValue({ type: 'VideoProcessingFailed' }),
    };
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    useCase = new ProcessVideoJobUseCase(
      jobs,
      storage,
      extractor,
      completedEvents,
      startedEvents,
      failedEvents,
      logger,
    );
  });

  it('skips already-completed jobs (idempotency)', async () => {
    jobs.ensureJob.mockResolvedValue(makeJob(ProcessingJobStatus.Completed));

    await useCase.execute({
      videoJobId: 'job-id',
      userId: 'user-id',
      userEmail: 'user@fiap.com',
      originalFileName: 'video.mp4',
      storageKey: 'videos/job-id-video.mp4',
      correlationId: 'corr-id',
    });

    expect(jobs.updateStatusWithOutbox).not.toHaveBeenCalled();
    expect(extractor.extractFramesToZip).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Job já processado — idempotente', {
      videoJobId: 'job-id',
    });
  });

  it('processes video, publishes started and completed events on success', async () => {
    await useCase.execute({
      videoJobId: 'job-id',
      userId: 'user-id',
      userEmail: 'user@fiap.com',
      originalFileName: 'video.mp4',
      storageKey: 'videos/job-id-video.mp4',
      correlationId: 'corr-id',
    });

    expect(jobs.ensureJob).toHaveBeenCalledWith({
      id: 'job-id',
      userId: 'user-id',
      userEmail: 'user@fiap.com',
      originalFileName: 'video.mp4',
      storageKey: 'videos/job-id-video.mp4',
      correlationId: 'corr-id',
    });
    expect(storage.resolveVideoPath).toHaveBeenCalledWith('videos/job-id-video.mp4');
    expect(storage.buildZipPath).toHaveBeenCalledWith('job-id');
    expect(extractor.extractFramesToZip).toHaveBeenCalledWith(
      '/storage/videos/job-id-video.mp4',
      '/storage/zips/job-id.zip',
    );
    expect(jobs.updateStatusWithOutbox).toHaveBeenCalledTimes(2);
    expect(startedEvents.buildEnvelope).toHaveBeenCalled();
    expect(completedEvents.buildEnvelope).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Processamento concluído', {
      videoJobId: 'job-id',
    });
  });

  it('publishes failed event when ffmpeg throws', async () => {
    extractor.extractFramesToZip.mockRejectedValue(new Error('codec not found'));

    await useCase.execute({
      videoJobId: 'job-id',
      userId: 'user-id',
      userEmail: 'user@fiap.com',
      originalFileName: 'video.mp4',
      storageKey: 'videos/job-id-video.mp4',
      correlationId: 'corr-id',
    });

    expect(jobs.updateStatusWithOutbox).toHaveBeenCalledTimes(2);
    expect(failedEvents.buildEnvelope).toHaveBeenCalledWith(
      expect.any(ProcessingJob),
      'user@fiap.com',
      'codec not found',
    );
    expect(logger.error).toHaveBeenCalledWith('Processamento falhou', {
      videoJobId: 'job-id',
      error: 'codec not found',
    });
  });
});
