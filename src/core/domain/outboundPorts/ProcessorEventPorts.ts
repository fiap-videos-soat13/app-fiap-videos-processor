import type { ProcessingJob } from '@domain/entities/ProcessingJob';
import type { VideoEventEnvelope } from '@validators/VideoEventEnvelopeValidator';

export abstract class VideoProcessingCompletedEventPort {
  abstract buildEnvelope(job: ProcessingJob): VideoEventEnvelope;
}

export abstract class VideoProcessingStartedEventPort {
  abstract buildEnvelope(job: ProcessingJob): VideoEventEnvelope;
}

export abstract class VideoProcessingFailedEventPort {
  abstract buildEnvelope(
    job: ProcessingJob,
    userEmail: string,
    errorMessage: string,
  ): VideoEventEnvelope;
}
