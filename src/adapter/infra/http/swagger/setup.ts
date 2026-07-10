import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

type OpsOpenApiOptions = {
  title: string;
  description: string;
  port: number;
};

export function createOpsOpenApiDocument(options: OpsOpenApiOptions) {
  return {
    openapi: '3.0.3',
    info: {
      title: options.title,
      description: options.description,
      version: '0.1.0',
    },
    servers: [
      {
        url: `http://localhost:${options.port}`,
        description: 'Local',
      },
    ],
    tags: [{ name: 'Ops', description: 'Health e métricas' }],
    paths: {
      '/health/live': {
        get: {
          tags: ['Ops'],
          summary: 'Liveness',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/health/ready': {
        get: {
          tags: ['Ops'],
          summary: 'Readiness (Postgres)',
          responses: {
            '200': { description: 'DB up' },
            '503': { description: 'DB down' },
          },
        },
      },
      '/metrics': {
        get: {
          tags: ['Ops'],
          summary: 'Prometheus metrics',
          responses: { '200': { description: 'text/plain metrics' } },
        },
      },
    },
  } as const;
}

export function setupOpsSwagger(
  app: Express,
  document: ReturnType<typeof createOpsOpenApiDocument>,
): void {
  app.get('/api/docs.json', (_req, res) => {
    res.json(document);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document));
}
