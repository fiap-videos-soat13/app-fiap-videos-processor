import { eq } from 'drizzle-orm';
import { getDb } from '@adapter/infra/database/client';
import { processedEvents } from '@adapter/infra/database/schema';
import type { VideoEventEnvelope } from '@validators/VideoEventEnvelopeValidator';
import type { LoggerPort } from '@domain/outboundPorts/LoggerPort';
import type { SagaMetricsService } from '@adapter/infra/observability/SagaMetricsService';

export class Inbox {
  constructor(
    private readonly logger: LoggerPort,
    private readonly sagaMetrics?: SagaMetricsService,
  ) {}

  async runOnce(
    envelope: VideoEventEnvelope,
    consumerName: string,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    const db = getDb();

    const inserted = await db
      .insert(processedEvents)
      .values({
        eventId: envelope.eventId,
        consumerName,
        eventType: envelope.eventType,
        videoJobId: envelope.videoJobId,
        processedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [processedEvents.eventId, processedEvents.consumerName],
      })
      .returning();

    if (inserted.length === 0) {
      this.logger.log('Inbox dedup — evento já processado', {
        eventId: envelope.eventId,
        consumerName,
      });
      this.sagaMetrics?.recordDuplicateSkipped(consumerName);
      return false;
    }

    try {
      await handler();
      this.sagaMetrics?.recordConsumed(envelope.eventType, consumerName);
      return true;
    } catch (err) {
      await db
        .delete(processedEvents)
        .where(eq(processedEvents.eventId, envelope.eventId));
      throw err;
    }
  }
}
