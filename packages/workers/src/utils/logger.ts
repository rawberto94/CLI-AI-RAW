/**
 * Simple logger utility for agents
 */

import pino from 'pino';

export const logger = pino({
  name: 'agents',
  level: process.env.LOG_LEVEL || 'info',
});

export default logger;
