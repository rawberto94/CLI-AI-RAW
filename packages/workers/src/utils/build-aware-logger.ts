/**
 * Build-time aware logger
 * Silences logs during Next.js build to prevent initialization issues
 */
import pino from 'pino';

// Check if we're in build mode
export const isBuildTime = process.env.NEXT_BUILD === 'true';

/**
 * Create a build-time aware logger
 * @param name Logger name
 * @returns Pino logger instance that is silent during builds
 */
export function createLogger(name: string) {
  return pino({
    name,
    level: isBuildTime ? 'silent' : (process.env.LOG_LEVEL || 'info'),
    ...(isBuildTime ? {} : {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }),
  });
}

/**
 * Skip function if in build time
 * Useful for skipping initialization code during builds
 */
export function skipIfBuilding<T>(fn: () => T, defaultValue: T): T {
  if (isBuildTime) {
    return defaultValue;
  }
  return fn();
}

export default createLogger;
