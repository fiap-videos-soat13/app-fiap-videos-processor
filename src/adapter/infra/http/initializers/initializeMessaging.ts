import { AmqpConnection } from '@adapter/infra/messaging/amqp/AmqpConnection';
import { AmqpPublisher } from '@adapter/infra/messaging/amqp/AmqpPublisher';
import { OutboxRelayWorker } from '@adapter/infra/messaging/outbox/OutboxRelayWorker';
import { Inbox } from '@adapter/infra/messaging/inbox/Inbox';
import { VideoProcessingRequestedSubscriber } from '@adapter/infra/messaging/subscribers/VideoProcessingRequestedSubscriber';
import type { InfrastructureContext, UseCaseContext, MessagingContext } from './types';

export function initializeMessaging(
  infra: InfrastructureContext,
  useCases: UseCaseContext,
): MessagingContext {
  const exchange =
    process.env.VIDEO_EVENTS_EXCHANGE?.trim() || 'fiap-videos.events';
  const dlx =
    process.env.VIDEO_EVENTS_DLX?.trim() || 'fiap-videos.events.dlx';
  const amqp = new AmqpConnection(
    infra.logger,
    exchange,
    dlx,
    process.env.RABBITMQ_CONNECTION_NAME?.trim() || 'processor',
  );
  const publisher = new AmqpPublisher(amqp);
  const outboxRelay = new OutboxRelayWorker(
    publisher,
    infra.logger,
    infra.sagaMetrics,
  );
  const inbox = new Inbox(infra.logger, infra.sagaMetrics);
  const subscriber = new VideoProcessingRequestedSubscriber(
    amqp,
    inbox,
    infra.logger,
    useCases.processVideo,
  );

  return { amqp, outboxRelay, inbox, subscriber };
}
