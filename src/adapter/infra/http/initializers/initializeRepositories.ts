import { DrizzleProcessingJobRepository } from '@adapter/infra/repository/DrizzleProcessingJobRepository';
import { createVideoStorage } from '@adapter/infra/storage/storageFactory';
import { FfmpegFrameExtractor } from '@adapter/infra/video/FfmpegFrameExtractor';
import {
  VideoProcessingCompletedEnvelopeBuilder,
  VideoProcessingFailedEnvelopeBuilder,
  VideoProcessingStartedEnvelopeBuilder,
} from '@adapter/infra/messaging/builders/ProcessorEventBuilders';
import type { RepositoryContext } from './types';

export function initializeRepositories(): RepositoryContext {
  return {
    jobs: new DrizzleProcessingJobRepository(),
    storage: createVideoStorage(),
    extractor: new FfmpegFrameExtractor(
      process.env.FFMPEG_PATH?.trim() || 'ffmpeg',
    ),
    completed: new VideoProcessingCompletedEnvelopeBuilder(),
    started: new VideoProcessingStartedEnvelopeBuilder(),
    failed: new VideoProcessingFailedEnvelopeBuilder(),
  };
}
