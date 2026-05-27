import { buildApp } from './app.js';
import { CONFIG } from './config/constants.js';
import { env } from './config/env.js';

/**
 * Bootstrap: build app, listen, va dang ky graceful shutdown + global error traps.
 */
async function main(): Promise<void> {
  const app = await buildApp();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'Shutdown signal received, closing server');

    const forceTimer = setTimeout(() => {
      app.log.fatal('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, CONFIG.GRACEFUL_SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    try {
      await app.close();
      clearTimeout(forceTimer);
      app.log.info('Server closed cleanly');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('unhandledRejection', (reason) => {
    app.log.fatal({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });

  try {
    await app.listen({ port: env.PORT, host: env.API_HOST });
    app.log.info(`Server listening on http://${env.API_HOST}:${env.PORT}`);
  } catch (err) {
    app.log.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

void main();
