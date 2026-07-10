import type { Channel } from 'amqplib';

export async function assertVideoTopology(
  ch: Channel,
  exchange: string,
  dlx: string,
): Promise<void> {
  await ch.assertExchange(exchange, 'topic', { durable: true });
  await ch.assertExchange(dlx, 'topic', { durable: true });
}

export function queueName(service: string, eventType: string): string {
  return `fiap-videos.${service}.${eventType}`;
}

export function dlqName(service: string, eventType: string): string {
  return `fiap-videos.${service}.${eventType}.dlq`;
}
