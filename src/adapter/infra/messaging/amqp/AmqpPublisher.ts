import type { ConfirmChannel } from 'amqplib';
import type { VideoEventEnvelope } from '@validators/VideoEventEnvelopeValidator';
import { AmqpConnection } from './AmqpConnection';

export class AmqpPublisher {
  constructor(private readonly connection: AmqpConnection) {}

  async publish(envelope: VideoEventEnvelope): Promise<void> {
    const ch = await this.connection.getConfirmChannel();
    const exchange = this.connection.exchange();
    const body = Buffer.from(JSON.stringify(envelope), 'utf8');

    ch.publish(exchange, envelope.eventType, body, {
      contentType: 'application/json',
      persistent: true,
      messageId: envelope.eventId,
      correlationId: envelope.correlationId,
      timestamp: Date.now(),
    });

    await waitForConfirms(ch);
  }
}

function waitForConfirms(ch: ConfirmChannel): Promise<void> {
  return ch.waitForConfirms();
}
