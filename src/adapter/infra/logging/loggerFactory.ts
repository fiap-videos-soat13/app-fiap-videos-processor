import { LoggerPort } from '@domain/outboundPorts/LoggerPort';
import { PinoLoggerAdapter } from './PinoLoggerAdapter';

export function createLogger(serviceName: string): LoggerPort {
  return new PinoLoggerAdapter(serviceName);
}
