import type { Channel, ConsumeMessage } from 'amqplib';
import {
  parseEnvelope,
  type VideoEventEnvelope,
} from '@validators/VideoEventEnvelopeValidator';
import { AmqpConnection } from '../amqp/AmqpConnection';
import { Inbox } from '../inbox/Inbox';
import type { LoggerPort } from '@domain/outboundPorts/LoggerPort';

export type EventHandler<TPayload> = (
  envelope: VideoEventEnvelope,
  payload: TPayload,
) => Promise<void>;

export interface BaseEventSubscriberConfig<TPayload> {
  consumerName: string;
  queueName: string;
  eventType: string;
  parsePayload: (payload: unknown) => TPayload;
  onEvent: EventHandler<TPayload>;
}

export class BaseEventSubscriber<TPayload> {
  private channel: Channel | null = null;
  private consumerTag: string | null = null;
  private readonly dlqName: string;

  constructor(
    private readonly connection: AmqpConnection,
    private readonly inbox: Inbox,
    private readonly logger: LoggerPort,
    private readonly config: BaseEventSubscriberConfig<TPayload>,
  ) {
    this.dlqName = `${config.queueName}.dlq`;
  }

  async start(): Promise<void> {
    await this.bind();
  }

  async stop(): Promise<void> {
    const ch = this.channel;
    const tag = this.consumerTag;
    this.channel = null;
    this.consumerTag = null;
    if (!ch) {
      return;
    }
    try {
      if (tag) {
        await ch.cancel(tag);
      }
      await ch.close();
    } catch {
      // ignore shutdown errors
    }
  }

  private async bind(): Promise<void> {
    await this.stop();

    const ch = await this.connection.createConsumerChannel();
    this.channel = ch;
    const exchange = this.connection.exchange();
    const dlx = this.connection.dlx();

    await ch.assertQueue(this.dlqName, { durable: true });
    await ch.bindQueue(this.dlqName, dlx, this.config.queueName);

    await ch.assertQueue(this.config.queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlx,
        'x-dead-letter-routing-key': this.config.queueName,
      },
    });
    await ch.bindQueue(this.config.queueName, exchange, this.config.eventType);
    await ch.prefetch(Number(process.env.CONSUMER_PREFETCH) || 8);

    const { consumerTag } = await ch.consume(
      this.config.queueName,
      (msg) => {
        if (!msg) {
          return;
        }
        void this.handle(ch, msg);
      },
      { noAck: false },
    );
    this.consumerTag = consumerTag;

    this.logger.log(
      `Subscriber ativo: ${this.config.eventType} → ${this.config.queueName}`,
    );
  }

  private async handle(ch: Channel, msg: ConsumeMessage): Promise<void> {
    let envelope: VideoEventEnvelope;
    try {
      const raw: unknown = JSON.parse(msg.content.toString('utf8'));
      envelope = parseEnvelope(raw);
    } catch (err) {
      this.logger.error(
        `Envelope inválido: ${err instanceof Error ? err.message : String(err)}`,
      );
      ch.nack(msg, false, false);
      return;
    }

    if (envelope.eventType !== this.config.eventType) {
      ch.ack(msg);
      return;
    }

    try {
      const applied = await this.inbox.runOnce(
        envelope,
        this.config.consumerName,
        async () => {
          const payload = this.config.parsePayload(envelope.payload);
          await this.config.onEvent(envelope, payload);
        },
      );

      if (!applied) {
        this.logger.log('Evento duplicado — ack sem reprocessar', {
          eventId: envelope.eventId,
        });
      }
      ch.ack(msg);
    } catch (err) {
      this.logger.error(
        `Handler falhou eventId=${envelope.eventId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      ch.nack(msg, false, false);
    }
  }
}
