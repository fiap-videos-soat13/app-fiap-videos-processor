import type { Express } from 'express';
import type { Registry } from 'prom-client';
import type { AmqpConnection } from '@adapter/infra/messaging/amqp/AmqpConnection';
import type { OutboxRelayWorker } from '@adapter/infra/messaging/outbox/OutboxRelayWorker';
import type { Inbox } from '@adapter/infra/messaging/inbox/Inbox';
import type { VideoProcessingRequestedSubscriber } from '@adapter/infra/messaging/subscribers/VideoProcessingRequestedSubscriber';
import type { DrizzleProcessingJobRepository } from '@adapter/infra/repository/DrizzleProcessingJobRepository';
import type { FfmpegFrameExtractor } from '@adapter/infra/video/FfmpegFrameExtractor';
import type {
  VideoProcessingCompletedEnvelopeBuilder,
  VideoProcessingFailedEnvelopeBuilder,
  VideoProcessingStartedEnvelopeBuilder,
} from '@adapter/infra/messaging/builders/ProcessorEventBuilders';
import type { ProcessVideoJobUseCase } from '@use-cases/videoJob/ProcessVideoJobUseCase';
import type { SagaMetricsService } from '@adapter/infra/observability/SagaMetricsService';
import type { LoggerPort } from '@domain/outboundPorts/LoggerPort';
import type { VideoStoragePort } from '@domain/outboundPorts/VideoStoragePort';
import type { registerHttpMetrics } from '../middleware/metrics.middleware';

export type InfrastructureContext = {
  logger: LoggerPort;
  registry: Registry;
  httpMetrics: ReturnType<typeof registerHttpMetrics>;
  sagaMetrics: SagaMetricsService;
};

export type RepositoryContext = {
  jobs: DrizzleProcessingJobRepository;
  storage: VideoStoragePort;
  extractor: FfmpegFrameExtractor;
  completed: VideoProcessingCompletedEnvelopeBuilder;
  started: VideoProcessingStartedEnvelopeBuilder;
  failed: VideoProcessingFailedEnvelopeBuilder;
};

export type UseCaseContext = {
  processVideo: ProcessVideoJobUseCase;
};

export type MessagingContext = {
  amqp: AmqpConnection;
  outboxRelay: OutboxRelayWorker;
  inbox: Inbox;
  subscriber: VideoProcessingRequestedSubscriber;
};

export type ProcessorContext = {
  app: Express;
  amqp: AmqpConnection;
  subscriber: VideoProcessingRequestedSubscriber;
};
