import type { Express } from 'express';
import {
  createOpsOpenApiDocument,
  setupOpsSwagger,
} from '../swagger/setup';
import { metricsHandler } from '../middleware/metrics.middleware';
import { checkDatabaseConnectivity } from '@adapter/infra/database/client';
import type { InfrastructureContext } from './types';

function registerHealthRoutes(app: Express): void {
  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.get('/health/ready', (_req, res) => {
    void checkDatabaseConnectivity().then((ok) => {
      res.status(ok ? 200 : 503).json({ database: ok ? 'up' : 'down' });
    });
  });
}

function registerMetricsRoutes(app: Express, infra: InfrastructureContext): void {
  app.get('/metrics', (req, res, next) => {
    void metricsHandler(
      req,
      res,
      infra.registry,
      infra.httpMetrics.databaseUp,
      checkDatabaseConnectivity,
    ).catch(next);
  });
}

export function initializeInternalRoutes(
  app: Express,
  infra: InfrastructureContext,
): void {
  const port = Number(process.env.PORT) || 3001;
  const openApi = createOpsOpenApiDocument({
    title: 'FIAP Videos Processor',
    description:
      'Worker ffmpeg: consome VideoProcessingRequested, publica completed/failed.',
    port,
  });

  setupOpsSwagger(app, openApi);
  registerHealthRoutes(app);
  registerMetricsRoutes(app, infra);
}
