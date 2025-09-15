import { FastifyInstance } from 'fastify';

interface Closable { close: () => Promise<any> | any }

export function setupGracefulShutdown(app: FastifyInstance, opts: { queues?: Array<{ name: string; close: () => Promise<any> | any }> } = {}) {
  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'graceful-shutdown-start');
    const timeout = setTimeout(() => {
      app.log.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 15000);

    try {
      // Stop accepting new connections
      try { await app.close(); } catch (e) { app.log.warn({ err: (e as any)?.message }, 'fastify-close-failed'); }

      // Close queues if provided
      if (opts.queues) {
        for (const q of opts.queues) {
          try { await q.close(); app.log.info({ queue: q.name }, 'queue-closed'); } catch (e) { app.log.warn({ queue: q.name, err: (e as any)?.message }, 'queue-close-failed'); }
        }
      }

      clearTimeout(timeout);
      app.log.info('graceful-shutdown-complete');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'graceful-shutdown-error');
      process.exit(1);
    }
  }

  ['SIGINT','SIGTERM'].forEach(sig => {
    process.on(sig as NodeJS.Signals, () => shutdown(sig));
  });

  // Safety: handle uncaught errors
  process.on('uncaughtException', (err) => {
    app.log.error({ err }, 'uncaught-exception');
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'unhandled-rejection');
  });
}
