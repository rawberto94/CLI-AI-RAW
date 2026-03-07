/**
 * Simple logger utility for agents
 */

import pino from 'pino';

// Check if we're in Next.js build mode
const isBuildTime = process.env.NEXT_BUILD === 'true' || 
                    process.env.NODE_ENV === 'production' && typeof window === 'undefined' && !process.env.REDIS_URL;

export const logger = pino({
  name: 'agents',
  level: isBuildTime ? 'silent' : (process.env.LOG_LEVEL || 'info'),
});

export default logger;
