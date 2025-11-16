import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { appConfig } from './config/app.config.js';
import connectMongoDB from './config/mongoose.js';
import { initRedis, closeRedis } from './config/redis.config.js';
import logger from './utils/logger.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

// Load .env file from backend root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Log DATABASE_URL status for debugging
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  logger.info(`📋 DATABASE_URL loaded: ${url.hostname} (Supabase)`);
} else {
  logger.warn('⚠️  DATABASE_URL not found in .env file');
}

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
    logger.info('🔄 Starting database connections...');
    
    // Connect to MongoDB and wait for it to be fully ready
    await connectMongoDB();
    
    // Ensure MongoDB connection is fully established before proceeding
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) {
      logger.warn('⚠️  MongoDB connection not fully established, waiting...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MongoDB connection timeout after waiting'));
        }, 10000);
        
        if (mongoose.connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }
    
    // Verify database object is available
    if (!mongoose.connection.db) {
      throw new Error('MongoDB connection established but database object is not available');
    }
    
    logger.info('✅ MongoDB connection verified and ready for model operations');
    // MongoDB connection success is logged in mongoose.js connection event handler

    // Initialize Redis cache (optional - server can run without it)
    try {
      await initRedis();
    } catch (error) {
      logger.warn('⚠️  Redis initialization failed (caching disabled):', error.message);
    }

    // Test PostgreSQL connection (optional - server can run without it)
    let db = null;
    let postgresConnected = false;
    try {
      const knexModule = await import('./config/knex.js');
      db = knexModule.default;
      await db.raw('SELECT 1');
      // Log PostgreSQL connection details
      knexModule.logPostgresConnection();
      postgresConnected = true;
    } catch (error) {
      const knexConfig = (await import('./config/knex.config.js')).default;
      const env = process.env.NODE_ENV || 'development';
      const pgConfig = knexConfig[env]?.connection || {};
      
      logger.warn('⚠️  PostgreSQL connection failed (server will continue without it):');
      logger.warn(`   Error: ${error.message}`);
      
      // Check if DATABASE_URL is set
      if (process.env.DATABASE_URL) {
        try {
          const url = new URL(process.env.DATABASE_URL);
          logger.warn(`   Attempted connection to: ${url.hostname}:${url.port || '5432'}`);
          logger.warn(`   Database: ${url.pathname.slice(1) || 'N/A'}`);
          logger.warn(`   User: ${url.username || 'N/A'}`);
        } catch (e) {
          logger.warn(`   DATABASE_URL is set but could not parse: ${process.env.DATABASE_URL.substring(0, 30)}...`);
        }
      } else if (typeof pgConfig === 'string') {
        try {
          const url = new URL(pgConfig);
          logger.warn(`   Attempted connection to: ${url.hostname}:${url.port || '5432'}`);
        } catch (e) {
          logger.warn(`   Connection string provided (format: postgresql://...)`);
        }
      } else if (pgConfig.connectionString) {
        try {
          const url = new URL(pgConfig.connectionString);
          logger.warn(`   Attempted connection to: ${url.hostname}:${url.port || '5432'}`);
          logger.warn(`   Database: ${url.pathname.slice(1) || 'N/A'}`);
          logger.warn(`   User: ${url.username || 'N/A'}`);
        } catch (e) {
          logger.warn(`   Connection string in config but could not parse`);
        }
      } else {
        logger.warn(`   Attempted connection to: ${pgConfig.host || 'localhost'}:${pgConfig.port || 5432}`);
        logger.warn(`   Database: ${pgConfig.database || 'N/A'}`);
        logger.warn(`   User: ${pgConfig.user || 'N/A'}`);
      }
      
      logger.warn('   The server will start, but SQL dataset features will be unavailable.');
      logger.warn('   To fix:');
      logger.warn('     1. Ensure PostgreSQL is running');
      logger.warn('     2. Check connection details in .env file (PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD)');
      logger.warn('     3. Verify network connectivity and firewall settings');
      postgresConnected = false;
    }
    
    if (postgresConnected) {
      logger.info('✅ All database connections established successfully!');
    } else {
      logger.info('✅ Server starting with MongoDB only (PostgreSQL unavailable)');
    }

    // Start server
    const server = app.listen(appConfig.port, appConfig.host, () => {
      logger.info(`Smart Storage System running on http://${appConfig.host}:${appConfig.port}`);
      logger.info(`Environment: ${appConfig.env}`);
    });

    // Handle server errors (e.g., port already in use)
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${appConfig.port} is already in use!`);
        logger.error(`   Please either:`);
        logger.error(`   1. Stop the process using port ${appConfig.port}`);
        logger.error(`   2. Change the PORT in your .env file`);
        logger.error(`   3. Kill the process: taskkill /F /PID <process_id>`);
        logger.error(`   Find process: netstat -ano | findstr :${appConfig.port}`);
      } else {
        logger.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Received shutdown signal, closing server...');
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          if (db) {
            await db.destroy();
            logger.info('PostgreSQL connection closed');
          }
          await import('mongoose').then(m => m.default.connection.close());
          logger.info('MongoDB connection closed');
          await closeRedis();
          logger.info('Redis connection closed');
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
