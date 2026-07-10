export abstract class LoggerService {
  abstract log(message: string, context?: Record<string, string>): void;
  abstract error(message: string, context?: Record<string, string>): void;
}
