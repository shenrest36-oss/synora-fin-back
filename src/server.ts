import { config } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './database/prisma';
import { seedDefaultData } from './database/seed';
import app from './app';

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    await seedDefaultData();

    const server = app.listen(config.port, () => {
      logger.info(
        `Server running on port ${config.port} [${config.nodeEnv}]`,
      );
      logger.info(`API: http://localhost:${config.port}/api/v1`);
      logger.info(`Health: http://localhost:${config.port}/api/v1/health`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

void startServer();
