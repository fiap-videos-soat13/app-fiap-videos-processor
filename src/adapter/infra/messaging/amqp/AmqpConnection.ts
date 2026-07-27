import * as amqp from 'amqplib';
import type { ConfirmChannel, ChannelModel } from 'amqplib';
import { assertVideoTopology } from './AmqpTopology';
import type { LoggerPort } from '@domain/outboundPorts/LoggerPort';

export class AmqpConnection {
  private model: ChannelModel | null = null;
  private confirmChannel: ConfirmChannel | null = null;
  private confirmChannelPromise: Promise<ConfirmChannel> | null = null;

  constructor(
    private readonly logger: LoggerPort,
    private readonly exchangeName: string,
    private readonly dlxName: string,
    private readonly connectionName: string,
  ) {}

  async connect(): Promise<void> {
    const url = resolveRabbitUrl();
    this.logger.log(`Conectando ao RabbitMQ (${redact(url)})`);
    this.model = await amqp.connect(url, {
      clientProperties: { connection_name: this.connectionName },
    });

    const ch = await this.model.createChannel();
    try {
      await assertVideoTopology(ch, this.exchangeName, this.dlxName);
    } finally {
      await ch.close();
    }
    this.logger.log(`Topologia AMQP declarada em ${this.exchangeName}`);
  }

  async close(): Promise<void> {
    this.confirmChannel = null;
    this.confirmChannelPromise = null;
    await this.model?.close();
    this.model = null;
  }

  exchange(): string {
    return this.exchangeName;
  }

  dlx(): string {
    return this.dlxName;
  }

  async getConfirmChannel(): Promise<ConfirmChannel> {
    if (this.confirmChannel) {
      return this.confirmChannel;
    }
    if (!this.confirmChannelPromise) {
      this.confirmChannelPromise = this.openConfirmChannel();
    }
    return this.confirmChannelPromise;
  }

  async createConsumerChannel(): Promise<amqp.Channel> {
    if (!this.model) {
      throw new Error('AmqpConnection not initialized');
    }
    return this.model.createChannel();
  }

  private async openConfirmChannel(): Promise<ConfirmChannel> {
    if (!this.model) {
      throw new Error('AmqpConnection not initialized');
    }
    const ch = await this.model.createConfirmChannel();
    ch.on('close', () => {
      if (this.confirmChannel === ch) {
        this.confirmChannel = null;
        this.confirmChannelPromise = null;
      }
    });
    this.confirmChannel = ch;
    return ch;
  }
}

function resolveRabbitUrl(): string {
  const explicit = process.env.RABBITMQ_URL?.trim();
  if (explicit) {
    return explicit;
  }
  throw new Error('RABBITMQ_URL must be configured');
}

function redact(url: string): string {
  return url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}
