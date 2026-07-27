import { initializeInfrastructure } from './initializers/initializeInfrastructure';
import { initializeRepositories } from './initializers/initializeRepositories';
import { initializeUseCases } from './initializers/initializeUseCases';
import { initializeMessaging } from './initializers/initializeMessaging';
import { initializeExpress } from './initializers/initializeExpress';
import { initializeInternalRoutes } from './initializers/initializeInternalRoutes';
import { startOutboxRelay } from './workers/startOutboxRelay';
import type { ProcessorContext } from './initializers/types';

export type { ProcessorContext } from './initializers/types';

export function buildProcessorServer(): ProcessorContext {
  const infra = initializeInfrastructure();
  const repos = initializeRepositories();
  const useCases = initializeUseCases(repos, infra);
  const messaging = initializeMessaging(infra, useCases);
  const app = initializeExpress(infra);

  initializeInternalRoutes(app, infra);
  startOutboxRelay(messaging.outboxRelay);

  return {
    app,
    amqp: messaging.amqp,
    subscriber: messaging.subscriber,
  };
}
