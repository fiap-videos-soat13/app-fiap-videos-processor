import { asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@adapter/infra/database/client';
import {
  outbox,
  outboxDeadLetters,
} from '@adapter/infra/database/schema';
import { parseEnvelope } from '@validators/VideoEventEnvelopeValidator';
import { AmqpPublisher } from '../amqp/AmqpPublisher';
import { ConsoleLoggerService } from '@adapter/infra/services/ConsoleLoggerService';
import type { SagaMetricsService } from '@adapter/infra/observability/SagaMetricsService';

const BATCH_SIZE = 32;
const MAX_ATTEMPTS_DEFAULT = 10;

export class OutboxRelayWorker {
  private running = false;
  private readonly maxAttempts: number;

  constructor(
    private readonly publisher: AmqpPublisher,
    private readonly logger: ConsoleLoggerService,
    private readonly sagaMetrics?: SagaMetricsService,
  ) {
    this.maxAttempts =
      Number(process.env.OUTBOX_MAX_ATTEMPTS) || MAX_ATTEMPTS_DEFAULT;
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const batch = await this.publishBatch();
      if (batch.published > 0 || batch.failed > 0) {
        this.logger.log(
          `Outbox relay: published=${batch.published} failed=${batch.failed}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Outbox relay tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async publishBatch(): Promise<{ published: number; failed: number }> {
    const db = getDb();
    let published = 0;
    let failed = 0;

    await db.transaction(async (tx) => {
      const records = await tx
        .select()
        .from(outbox)
        .where(isNull(outbox.publishedAt))
        .orderBy(asc(outbox.occurredAt))
        .limit(BATCH_SIZE)
        .for('update', { skipLocked: true });

      for (const row of records) {
        try {
          const envelope = parseEnvelope(row.payload);
          await this.publisher.publish(envelope);
          await tx
            .update(outbox)
            .set({ publishedAt: new Date(), lastError: null })
            .where(eq(outbox.id, row.id));
          this.sagaMetrics?.recordPublished(envelope.eventType);
          published += 1;
        } catch (err) {
          failed += 1;
          const attempts = (row.attempts ?? 0) + 1;
          const message =
            err instanceof Error ? err.message : 'publish failed';

          if (attempts >= this.maxAttempts) {
            await tx.insert(outboxDeadLetters).values({
              id: row.id,
              aggregateType: row.aggregateType,
              aggregateId: row.aggregateId,
              eventType: row.eventType,
              payload: row.payload,
              occurredAt: row.occurredAt,
              attempts,
              lastError: message.slice(0, 1000),
              parkedAt: new Date(),
            });
            await tx.delete(outbox).where(eq(outbox.id, row.id));
          } else {
            await tx
              .update(outbox)
              .set({
                attempts: sql`${outbox.attempts} + 1`,
                lastError: message.slice(0, 1000),
              })
              .where(eq(outbox.id, row.id));
          }
        }
      }
    });

    return { published, failed };
  }
}
