import {
  VideoProcessingRequestedPayloadSchema,
  type VideoEventEnvelope,
} from '@validators/VideoEventEnvelopeValidator';
import { AmqpConnection } from '../amqp/AmqpConnection';
import { Inbox } from '../inbox/Inbox';
import { BaseEventSubscriber } from './BaseEventSubscriber';
import { SubscribersConfig } from './subscribersConfig';
import { ProcessVideoJobUseCase } from '@use-cases/videoJob/ProcessVideoJobUseCase';
import { ConsoleLoggerService } from '@adapter/infra/services/ConsoleLoggerService';
import type { z } from 'zod';

type RequestedPayload = z.infer<typeof VideoProcessingRequestedPayloadSchema>;

export class VideoProcessingRequestedSubscriber extends BaseEventSubscriber<RequestedPayload> {
  constructor(
    connection: AmqpConnection,
    inbox: Inbox,
    logger: ConsoleLoggerService,
    private readonly processVideo: ProcessVideoJobUseCase,
  ) {
    super(connection, inbox, logger, {
      consumerName: SubscribersConfig.VideoProcessingRequested.consumerName,
      queueName: SubscribersConfig.VideoProcessingRequested.queueName,
      eventType: SubscribersConfig.VideoProcessingRequested.eventType,
      parsePayload: (payload) =>
        VideoProcessingRequestedPayloadSchema.parse(payload),
      onEvent: async (
        envelope: VideoEventEnvelope,
        payload: RequestedPayload,
      ) => {
        await processVideo.execute({
          videoJobId: envelope.videoJobId,
          userId: payload.userId,
          userEmail: payload.userEmail,
          originalFileName: payload.originalFileName,
          storageKey: payload.storageKey,
          correlationId: envelope.correlationId,
        });
      },
    });
  }
}
