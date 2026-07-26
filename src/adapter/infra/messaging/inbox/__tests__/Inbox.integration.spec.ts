import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Inbox } from '../Inbox';
import { ConsoleLoggerService } from '@adapter/infra/services/ConsoleLoggerService';
import { VideoEventType } from '@validators/VideoEventEnvelopeValidator';
import type { VideoEventEnvelope } from '@validators/VideoEventEnvelopeValidator';
import { getDb } from '@adapter/infra/database/client';
import { processedEvents } from '@adapter/infra/database/schema';

function buildEnvelope(): VideoEventEnvelope {
  return {
    eventId: randomUUID(),
    correlationId: randomUUID(),
    workflowId: randomUUID(),
    videoJobId: randomUUID(),
    eventType: VideoEventType.VideoProcessingRequested,
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    payload: {
      userId: randomUUID(),
      userEmail: 'integration@fiap.local',
      originalFileName: 'video.mp4',
      storageKey: 'videos/job-video.mp4',
    },
  };
}

describe('Inbox integration', () => {
  const logger = new ConsoleLoggerService();
  const inbox = new Inbox(logger);

  beforeEach(() => {
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('handles a new event and records it in processed_events', async () => {
    const envelope = buildEnvelope();
    const handler = jest.fn(() => Promise.resolve());

    const handled = await inbox.runOnce(envelope, 'processor-worker', handler);

    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);

    const rows = await getDb()
      .select()
      .from(processedEvents)
      .where(eq(processedEvents.eventId, envelope.eventId));
    expect(rows).toHaveLength(1);
    expect(rows[0].consumerName).toBe('processor-worker');
    expect(rows[0].eventType).toBe(VideoEventType.VideoProcessingRequested);
  });

  it('skips a duplicate event for the same consumer', async () => {
    const envelope = buildEnvelope();
    const firstHandler = jest.fn(() => Promise.resolve());
    const secondHandler = jest.fn(() => Promise.resolve());

    const first = await inbox.runOnce(envelope, 'processor-worker', firstHandler);
    const second = await inbox.runOnce(envelope, 'processor-worker', secondHandler);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(secondHandler).not.toHaveBeenCalled();

    const rows = await getDb()
      .select()
      .from(processedEvents)
      .where(eq(processedEvents.eventId, envelope.eventId));
    expect(rows).toHaveLength(1);
  });

  it('processes the same event for a different consumer', async () => {
    const envelope = buildEnvelope();

    const first = await inbox.runOnce(envelope, 'processor-worker', () => Promise.resolve());
    const second = await inbox.runOnce(envelope, 'another-consumer', () => Promise.resolve());

    expect(first).toBe(true);
    expect(second).toBe(true);

    const rows = await getDb()
      .select()
      .from(processedEvents)
      .where(eq(processedEvents.eventId, envelope.eventId));
    expect(rows).toHaveLength(2);
  });

  it('removes the processed_events row when the handler fails so the event can be retried', async () => {
    const envelope = buildEnvelope();

    await expect(
      inbox.runOnce(envelope, 'processor-worker', () =>
        Promise.reject(new Error('handler boom')),
      ),
    ).rejects.toThrow('handler boom');

    const rowsAfterFailure = await getDb()
      .select()
      .from(processedEvents)
      .where(eq(processedEvents.eventId, envelope.eventId));
    expect(rowsAfterFailure).toHaveLength(0);

    const retried = await inbox.runOnce(envelope, 'processor-worker', () => Promise.resolve());
    expect(retried).toBe(true);
  });
});
