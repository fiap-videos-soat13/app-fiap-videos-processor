import express from 'express';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { ProcessVideoJobUseCase } from '@use-cases/videoJob/ProcessVideoJobUseCase';
import { DrizzleProcessingJobRepository } from '@adapter/infra/repository/DrizzleProcessingJobRepository';
import { createVideoStorage } from '@adapter/infra/storage/storageFactory';
import { FfmpegFrameExtractor } from '@adapter/infra/video/FfmpegFrameExtractor';
import {
  VideoProcessingCompletedEnvelopeBuilder,
  VideoProcessingFailedEnvelopeBuilder,
  VideoProcessingStartedEnvelopeBuilder,
} from '@adapter/infra/messaging/builders/ProcessorEventBuilders';
import { ConsoleLoggerService } from '@adapter/infra/services/ConsoleLoggerService';
import { AmqpConnection } from '@adapter/infra/messaging/amqp/AmqpConnection';
import { AmqpPublisher } from '@adapter/infra/messaging/amqp/AmqpPublisher';
import { OutboxRelayWorker } from '@adapter/infra/messaging/outbox/OutboxRelayWorker';
import { Inbox } from '@adapter/infra/messaging/inbox/Inbox';
import { VideoProcessingRequestedSubscriber } from '@adapter/infra/messaging/subscribers/VideoProcessingRequestedSubscriber';
import { checkDatabaseConnectivity } from '@adapter/infra/database/client';
import { SagaMetricsService } from '@adapter/infra/observability/SagaMetricsService';
import {
  createOpsOpenApiDocument,
  setupOpsSwagger,
} from './swagger/setup';
import {
  createMetricsMiddleware,
  metricsHandler,
  registerHttpMetrics,
} from './middleware/metrics.middleware';

export type ProcessorContext = {
  app: express.Express;
  amqp: AmqpConnection;
  subscriber: VideoProcessingRequestedSubscriber;
};

export function buildProcessorServer(): ProcessorContext {
  const logger = new ConsoleLoggerService('app-fiap-videos-processor');
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const httpMetrics = registerHttpMetrics(registry);
  const sagaMetrics = new SagaMetricsService(registry);

  const jobs = new DrizzleProcessingJobRepository();
  const storage = createVideoStorage();
  const extractor = new FfmpegFrameExtractor(
    process.env.FFMPEG_PATH?.trim() || 'ffmpeg',
  );
  const completed = new VideoProcessingCompletedEnvelopeBuilder();
  const started = new VideoProcessingStartedEnvelopeBuilder();
  const failed = new VideoProcessingFailedEnvelopeBuilder();

  const processVideo = new ProcessVideoJobUseCase(
    jobs,
    storage,
    extractor,
    completed,
    started,
    failed,
    logger,
  );

  const exchange =
    process.env.VIDEO_EVENTS_EXCHANGE?.trim() || 'fiap-videos.events';
  const dlx =
    process.env.VIDEO_EVENTS_DLX?.trim() || 'fiap-videos.events.dlx';
  const amqp = new AmqpConnection(
    logger,
    exchange,
    dlx,
    process.env.RABBITMQ_CONNECTION_NAME?.trim() || 'processor',
  );
  const publisher = new AmqpPublisher(amqp);
  const outboxRelay = new OutboxRelayWorker(publisher, logger, sagaMetrics);
  const inbox = new Inbox(logger, sagaMetrics);
  const subscriber = new VideoProcessingRequestedSubscriber(
    amqp,
    inbox,
    logger,
    processVideo,
  );

  const app = express();
  const port = Number(process.env.PORT) || 3001;
  const openApi = createOpsOpenApiDocument({
    title: 'FIAP Videos Processor',
    description:
      'Worker ffmpeg: consome VideoProcessingRequested, publica completed/failed.',
    port,
  });
  setupOpsSwagger(app, openApi);
  app.use(createMetricsMiddleware(registry, httpMetrics));

  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.get('/health/ready', (_req, res) => {
    void checkDatabaseConnectivity().then((ok) => {
      res.status(ok ? 200 : 503).json({ database: ok ? 'up' : 'down' });
    });
  });
  app.get('/metrics', (req, res, next) => {
    void metricsHandler(
      req,
      res,
      registry,
      httpMetrics.databaseUp,
      checkDatabaseConnectivity,
    ).catch(next);
  });

  const outboxRelayIntervalMs =
    Number(process.env.OUTBOX_RELAY_INTERVAL_MS) || 5000;
  const scheduleNextRelayTick = () => {
    setTimeout(() => {
      void outboxRelay.tick().then(scheduleNextRelayTick);
    }, outboxRelayIntervalMs);
  };
  scheduleNextRelayTick();

  return { app, amqp, subscriber };
}
