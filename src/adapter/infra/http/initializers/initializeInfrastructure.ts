import { Registry, collectDefaultMetrics } from 'prom-client';
import { createLogger } from '@adapter/infra/logging/loggerFactory';
import { SagaMetricsService } from '@adapter/infra/observability/SagaMetricsService';
import { registerHttpMetrics } from '../middleware/metrics.middleware';
import type { InfrastructureContext } from './types';

export function initializeInfrastructure(): InfrastructureContext {
  const logger = createLogger('app-fiap-videos-processor');
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const httpMetrics = registerHttpMetrics(registry);
  const sagaMetrics = new SagaMetricsService(registry);

  return { logger, registry, httpMetrics, sagaMetrics };
}
