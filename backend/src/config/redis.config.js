import Redis from 'ioredis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../utils/logger.js';

// Load .env file from backend root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

let redis = null;
let isConnected = false;

/**
 * Initialize Redis connection
 * @returns {Promise<Redis|null>} Redis client instance or null if disabled/failed
 */
export const initRedis = async () => {
  try {
    const cacheEnabled = process.env.CACHE_ENABLED === 'true';
    
    if (!cacheEnabled) {
      logger.info('📦 Redis caching is disabled (CACHE_ENABLED=false)');
      return null;
    }

    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT) || 6379;
    const redisPassword = process.env.REDIS_PASSWORD || undefined;
    const redisDb = parseInt(process.env.REDIS_DB) || 0;

    // Use URL if provided, otherwise use individual config
    const redisConfig = redisUrl
      ? { url: redisUrl }
      : {
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          db: redisDb,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          enableOfflineQueue: false,
        };

    redis = new Redis(redisConfig);

    // Connection event handlers
    redis.on('connect', () => {
      logger.info('🔄 Redis connecting...');
    });

    redis.on('ready', () => {
      isConnected = true;
      logger.info('✅ Redis connected successfully!');
    });

    redis.on('error', (error) => {
      isConnected = false;
      logger.warn('⚠️  Redis connection error:', error.message);
      // Don't throw - allow graceful degradation
    });

    redis.on('close', () => {
      isConnected = false;
      logger.warn('⚠️  Redis connection closed');
    });

    redis.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });

    // Wait for connection to be ready
    await redis.ping();
    isConnected = true;

    return redis;
  } catch (error) {
    logger.warn('⚠️  Failed to initialize Redis (caching disabled):', error.message);
    isConnected = false;
    redis = null;
    return null;
  }
};

/**
 * Get Redis client instance
 * @returns {Redis|null} Redis client or null if not initialized
 */
export const getRedis = () => {
  return redis;
};

/**
 * Check if Redis is connected
 * @returns {boolean} Connection status
 */
export const isRedisConnected = () => {
  return isConnected && redis !== null;
};

/**
 * Close Redis connection gracefully
 */
export const closeRedis = async () => {
  if (redis) {
    try {
      await redis.quit();
      logger.info('✅ Redis connection closed');
    } catch (error) {
      logger.warn('⚠️  Error closing Redis connection:', error.message);
    }
    redis = null;
    isConnected = false;
  }
};

export default { initRedis, getRedis, isRedisConnected, closeRedis };

