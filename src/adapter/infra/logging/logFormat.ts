export type LogFormat = 'json' | 'pretty';

export function resolveLogFormat(): LogFormat {
  const explicit = process.env.LOG_FORMAT?.trim().toLowerCase();
  if (explicit === 'json') {
    return 'json';
  }
  if (explicit === 'pretty') {
    return 'pretty';
  }
  return process.env.NODE_ENV === 'production' ? 'json' : 'pretty';
}
