import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const processedEvents = pgTable(
  'processed_events',
  {
    eventId: uuid('event_id').notNull(),
    consumerName: varchar('consumer_name', { length: 128 }).notNull(),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    videoJobId: uuid('video_job_id').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('processed_events_event_consumer_idx').on(
      table.eventId,
      table.consumerName,
    ),
  ],
);
