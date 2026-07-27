import type { OutboxRelayWorker } from '@adapter/infra/messaging/outbox/OutboxRelayWorker';

export function startOutboxRelay(outboxRelay: OutboxRelayWorker): void {
  const outboxRelayIntervalMs =
    Number(process.env.OUTBOX_RELAY_INTERVAL_MS) || 5000;
  const scheduleNextRelayTick = () => {
    setTimeout(() => {
      void outboxRelay.tick().then(scheduleNextRelayTick);
    }, outboxRelayIntervalMs);
  };
  scheduleNextRelayTick();
}
