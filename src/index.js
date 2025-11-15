import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { appConfig } from './config/app.config.js';
import connectMongoDB from './config/mongoose.js';
import logger from './utils/logger.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: appConfig.rateLimit.windowMs,
  max: appConfig.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Database connections and server startup
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectMongoDB();
    logger.info('MongoDB connection established');

    // Test PostgreSQL connection
    const db = (await import('./config/knex.js')).default;
    await db.raw('SELECT 1');
    logger.info('PostgreSQL connection established');

    // Start server
    const server = app.listen(appConfig.port, appConfig.host, () => {
      logger.info(`Smart Storage System running on http://${appConfig.host}:${appConfig.port}`);
      logger.info(`Environment: ${appConfig.env}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Received shutdown signal, closing server...');
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          await db.destroy();
          logger.info('PostgreSQL connection closed');
          await import('mongoose').then(m => m.default.connection.close());
          logger.info('MongoDB connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
