import pino from 'pino';
import { LoggerPort } from '@domain/outboundPorts/LoggerPort';
import { resolveLogFormat } from './logFormat';

export class PinoLoggerAdapter extends LoggerPort {
  private readonly logger: pino.Logger;

  constructor(serviceName: string) {
    super();
    const format = resolveLogFormat();
    const level = process.env.LOG_LEVEL?.trim() || 'info';

    this.logger = pino({
      level,
      base: { app: serviceName },
      ...(format === 'pretty'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    });
  }

  log(message: string, context?: Record<string, string>): void {
    this.logger.info(context ?? {}, message);
  }

  warn(message: string, context?: Record<string, string>): void {
    this.logger.warn(context ?? {}, message);
  }

  error(message: string, context?: Record<string, string>): void {
    this.logger.error(context ?? {}, message);
  }
}
