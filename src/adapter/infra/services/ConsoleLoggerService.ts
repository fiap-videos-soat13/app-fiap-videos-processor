const APP_NAME =
  process.env.METRICS_SERVICE_NAME?.trim() || 'app-fiap-videos-processor';

export class ConsoleLoggerService {
  constructor(private readonly app = APP_NAME) {}

  log(message: string, context?: Record<string, string>): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        app: this.app,
        message,
        ...context,
      }),
    );
  }

  warn(message: string, context?: Record<string, string>): void {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        app: this.app,
        message,
        ...context,
      }),
    );
  }

  error(message: string, context?: Record<string, string>): void {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        app: this.app,
        message,
        ...context,
      }),
    );
  }
}
