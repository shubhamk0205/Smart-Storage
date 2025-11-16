#!/usr/bin/env node

/**
 * Script to clear Redis cache
 * Usage: node scripts/clear-cache.js [pattern]
 * 
 * Examples:
 *   node scripts/clear-cache.js                    # Clear all dataset caches
 *   node scripts/clear-cache.js "dataset:*"        # Clear only dataset keys
 *   node scripts/clear-cache.js "datasets:list:*"  # Clear only list caches
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initRedis, closeRedis } from '../src/config/redis.config.js';
import cacheService from '../src/services/cache.service.js';
import logger from '../src/utils/logger.js';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function clearCache() {
  try {
    const pattern = process.argv[2] || null;

    logger.info('🔄 Connecting to Redis...');
    
    // Initialize Redis connection
    const redis = await initRedis();
    
    if (!redis) {
      logger.error('❌ Redis is not available or caching is disabled');
      logger.info('   Make sure CACHE_ENABLED=true in your .env file');
      logger.info('   And Redis server is running');
      process.exit(1);
    }

    logger.info('✅ Connected to Redis');
    
    // Clear cache
    if (pattern) {
      logger.info(`🗑️  Clearing cache with pattern: ${pattern}`);
      const deleted = await cacheService.delPattern(pattern);
      logger.info(`✅ Cleared ${deleted} key(s) matching pattern: ${pattern}`);
    } else {
      logger.info('🗑️  Clearing all dataset caches...');
      const deleted = await cacheService.clearAll();
      logger.info(`✅ Cleared ${deleted} key(s) total`);
    }

    // Close connection
    await closeRedis();
    
    logger.info('✅ Cache clearing complete!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error clearing cache:', error);
    await closeRedis();
    process.exit(1);
  }
}

clearCache();

