export type LogContext = Record<string, string>;

export abstract class LoggerPort {
  abstract log(message: string, context?: LogContext): void;
  abstract warn(message: string, context?: LogContext): void;
  abstract error(message: string, context?: LogContext): void;
}
