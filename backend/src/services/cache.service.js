import crypto from 'crypto';
import { getRedis, isRedisConnected } from '../config/redis.config.js';
import { appConfig } from '../config/app.config.js';
import logger from '../utils/logger.js';

class CacheService {
  /**
   * Check if caching is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return appConfig.cache?.enabled === true && isRedisConnected();
  }

  /**
   * Generate hash for cache keys
   * @param {string} input - Input string to hash
   * @returns {string} First 8 characters of MD5 hash
   */
  generateHash(input) {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 8);
  }

  /**
   * Generate cache key for dataset
   * @param {string} datasetId - Dataset ID
   * @returns {string} Cache key
   */
  generateDatasetKey(datasetId) {
    return `dataset:${datasetId}`;
  }

  /**
   * Generate cache key for dataset list
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Pagination options
   * @returns {string} Cache key
   */
  generateListKey(filters, options) {
    const filtersHash = this.generateHash(JSON.stringify(filters || {}));
    const optionsHash = this.generateHash(JSON.stringify(options || {}));
    return `datasets:list:${filtersHash}:${optionsHash}`;
  }

  /**
   * Generate cache key for search
   * @param {string} keyword - Search keyword
   * @returns {string} Cache key
   */
  generateSearchKey(keyword) {
    const keywordHash = this.generateHash(keyword.toLowerCase().trim());
    return `datasets:search:${keywordHash}`;
  }

  /**
   * Generate cache key for dataset stats
   * @param {string} datasetId - Dataset ID
   * @returns {string} Cache key
   */
  generateStatsKey(datasetId) {
    return `dataset:${datasetId}:stats`;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} Cached value or null
   */
  async get(key) {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const redis = getRedis();
      if (!redis) {
        return null;
      }

      const cached = await redis.get(key);
      if (cached) {
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
      
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.warn(`Redis cache error (falling back to DB) for key ${key}:`, error.message);
      return null; // Graceful degradation - return null to query DB
    }
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl) {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const redis = getRedis();
      if (!redis) {
        return false;
      }

      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.warn(`Redis cache SET error for key ${key}:`, error.message);
      return false; // Don't throw - just log and continue
    }
  }

  /**
   * Delete single cache key
   * @param {string} key - Cache key to delete
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const redis = getRedis();
      if (!redis) {
        return false;
      }

      const deleted = await redis.del(key);
      logger.debug(`Cache DEL: ${key} (${deleted} key(s) deleted)`);
      return deleted > 0;
    } catch (error) {
      logger.warn(`Redis cache DEL error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete all keys matching pattern
   * @param {string} pattern - Redis key pattern (e.g., 'datasets:list:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    if (!this.isEnabled()) {
      return 0;
    }

    try {
      const redis = getRedis();
      if (!redis) {
        return 0;
      }

      // Use SCAN instead of KEYS for better performance on large datasets
      const stream = redis.scanStream({
        match: pattern,
        count: 100,
      });

      let deletedCount = 0;
      const keysToDelete = [];

      // Collect all keys from stream
      await new Promise((resolve, reject) => {
        stream.on('data', (keys) => {
          keysToDelete.push(...keys);
        });

        stream.on('end', resolve);
        stream.on('error', reject);
      });

      // Delete in batches to avoid blocking
      if (keysToDelete.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);
          const deleted = await redis.del(...batch);
          deletedCount += deleted;
        }
        logger.info(`Cache invalidated: ${deletedCount} key(s) matching pattern ${pattern}`);
      }

      return deletedCount;
    } catch (error) {
      logger.warn(`Redis cache DEL pattern error for ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Invalidate all dataset list caches
   * @returns {Promise<number>} Number of keys deleted
   */
  async invalidateListCaches() {
    return await this.delPattern('datasets:list:*');
  }

  /**
   * Invalidate all search caches
   * @returns {Promise<number>} Number of keys deleted
   */
  async invalidateSearchCaches() {
    return await this.delPattern('datasets:search:*');
  }

  /**
   * Invalidate dataset-specific caches
   * @param {string} datasetId - Dataset ID
   * @returns {Promise<number>} Number of keys deleted
   */
  async invalidateDataset(datasetId) {
    const keys = [
      this.generateDatasetKey(datasetId),
      this.generateStatsKey(datasetId),
    ];
    
    let deletedCount = 0;
    for (const key of keys) {
      const deleted = await this.del(key);
      if (deleted) deletedCount++;
    }
    
    return deletedCount;
  }

  /**
   * Invalidate all caches related to a dataset operation
   * @param {string} datasetId - Dataset ID (optional)
   * @returns {Promise<number>} Total number of keys deleted
   */
  async invalidateAll(datasetId = null) {
    let totalDeleted = 0;
    
    // Invalidate dataset-specific caches
    if (datasetId) {
      totalDeleted += await this.invalidateDataset(datasetId);
    }
    
    // Invalidate list and search caches
    totalDeleted += await this.invalidateListCaches();
    totalDeleted += await this.invalidateSearchCaches();
    
    logger.info(`Cache invalidation complete: ${totalDeleted} key(s) deleted`);
    return totalDeleted;
  }
}

export default new CacheService();

