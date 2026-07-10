import type { Request, Response, NextFunction } from 'express';
import { Counter, Gauge, Histogram, type Registry } from 'prom-client';

function getOrCreateCounter(
  registry: Registry,
  name: string,
  help: string,
  labelNames: string[],
): Counter<string> {
  try {
    return new Counter({ name, help, labelNames, registers: [registry] });
  } catch {
    return registry.getSingleMetric(name) as Counter<string>;
  }
}

function getOrCreateHistogram(
  registry: Registry,
  name: string,
  help: string,
  labelNames: string[],
): Histogram<string> {
  try {
    return new Histogram({
      name,
      help,
      labelNames,
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    });
  } catch {
    return registry.getSingleMetric(name) as Histogram<string>;
  }
}

export function registerHttpMetrics(registry: Registry): {
  requestsTotal: Counter<string>;
  requestDuration: Histogram<string>;
  databaseUp: Gauge<string>;
} {
  const requestsTotal = getOrCreateCounter(
    registry,
    'http_requests_total',
    'Total de requisições HTTP',
    ['method', 'route', 'status_code'],
  );
  const requestDuration = getOrCreateHistogram(
    registry,
    'http_request_duration_seconds',
    'Duração das requisições HTTP em segundos',
    ['method', 'route', 'status_code'],
  );
  const databaseUp = new Gauge({
    name: 'database_up',
    help: '1 se o banco responde, 0 caso contrário',
    registers: [registry],
  });
  return { requestsTotal, requestDuration, databaseUp };
}

export function createMetricsMiddleware(
  registry: Registry,
  metrics: ReturnType<typeof registerHttpMetrics>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const method = req.method || 'unknown';
    const routePath = (req.route as { path?: string } | undefined)?.path;
    const route = routePath ? `${req.baseUrl}${routePath}` : req.path;

    res.on('finish', () => {
      const durationSec = (Date.now() - start) / 1000;
      const statusCode = String(res.statusCode || 0);
      metrics.requestsTotal.inc({ method, route, status_code: statusCode });
      metrics.requestDuration.observe(
        { method, route, status_code: statusCode },
        durationSec,
      );
      void registry;
    });
    next();
  };
}

export async function metricsHandler(
  _req: Request,
  res: Response,
  registry: Registry,
  databaseUp: Gauge<string>,
  checkDb: () => Promise<boolean>,
): Promise<void> {
  const ok = await checkDb();
  databaseUp.set(ok ? 1 : 0);
  res.setHeader('Content-Type', registry.contentType);
  res.send(await registry.metrics());
}
