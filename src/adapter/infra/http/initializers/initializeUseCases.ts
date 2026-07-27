import { ProcessVideoJobUseCase } from '@use-cases/videoJob/ProcessVideoJobUseCase';
import type { InfrastructureContext, RepositoryContext, UseCaseContext } from './types';

export function initializeUseCases(
  repos: RepositoryContext,
  infra: InfrastructureContext,
): UseCaseContext {
  const processVideo = new ProcessVideoJobUseCase(
    repos.jobs,
    repos.storage,
    repos.extractor,
    repos.completed,
    repos.started,
    repos.failed,
    infra.logger,
  );

  return { processVideo };
}
