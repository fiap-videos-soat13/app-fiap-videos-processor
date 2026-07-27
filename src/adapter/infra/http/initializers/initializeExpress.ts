import express, { type Express } from 'express';
import { createMetricsMiddleware } from '../middleware/metrics.middleware';
import type { InfrastructureContext } from './types';

export function initializeExpress(infra: InfrastructureContext): Express {
  const app = express();
  app.use(createMetricsMiddleware(infra.registry, infra.httpMetrics));
  return app;
}
