import pino, { type LoggerOptions } from 'pino';

function isNextBuild(): boolean {
  const argv = process.argv ?? [];
  const argvString = argv.join(' ');
  return (
    argv.includes('build') ||
    argvString.includes(' next build') ||
    argvString.includes('next build') ||
    argvString.includes('next/dist/bin/next build') ||
    argvString.includes('next/dist/build')
  );
}

function isBuildPhase(): boolean {
  const lifecycleEvent = process.env.npm_lifecycle_event;
  const lifecycleScript = process.env.npm_lifecycle_script ?? '';

  return (
    isNextBuild() ||
    lifecycleEvent === 'build' ||
    lifecycleScript.includes('next build') ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_BUILD === 'true'
  );
}

export function createLogger(name: string, options: LoggerOptions = {}) {
  const level = isBuildPhase() ? 'silent' : options.level ?? process.env.LOG_LEVEL;
  return pino({ ...options, name, level });
}
