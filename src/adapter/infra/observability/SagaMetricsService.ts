import { Counter, type Registry } from 'prom-client';

export class SagaMetricsService {
  private readonly serviceName: string;
  private readonly published: Counter<string>;
  private readonly consumed: Counter<string>;
  private readonly duplicateSkipped: Counter<string>;

  constructor(private readonly registry: Registry) {
    this.serviceName =
      process.env.METRICS_SERVICE_NAME?.trim() || 'app-fiap-videos-processor';
    this.published = this.getOrCreateCounter(
      'saga_events_published_total',
      'Eventos gravados no outbox e publicados',
      ['service', 'event_type'],
    );
    this.consumed = this.getOrCreateCounter(
      'saga_events_consumed_total',
      'Eventos aplicados pelos handlers (inbox)',
      ['service', 'event_type', 'consumer'],
    );
    this.duplicateSkipped = this.getOrCreateCounter(
      'saga_events_duplicate_skipped_total',
      'Entregas duplicadas ignoradas pelo inbox',
      ['service', 'consumer'],
    );
  }

  recordPublished(eventType: string): void {
    this.published.inc({ service: this.serviceName, event_type: eventType });
  }

  recordConsumed(eventType: string, consumerName: string): void {
    this.consumed.inc({
      service: this.serviceName,
      event_type: eventType,
      consumer: consumerName,
    });
  }

  recordDuplicateSkipped(consumerName: string): void {
    this.duplicateSkipped.inc({
      service: this.serviceName,
      consumer: consumerName,
    });
  }

  private getOrCreateCounter(
    name: string,
    help: string,
    labelNames: string[],
  ): Counter<string> {
    try {
      return new Counter({
        name,
        help,
        labelNames,
        registers: [this.registry],
      });
    } catch {
      return this.registry.getSingleMetric(name) as Counter<string>;
    }
  }
}
