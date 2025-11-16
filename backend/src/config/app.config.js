import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file from backend root directory (must be first)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

export const appConfig = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || 'localhost',
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
    maxFilesPerBatch: parseInt(process.env.MAX_FILES_PER_BATCH) || 20,
    maxTotalSize: parseInt(process.env.MAX_TOTAL_SIZE_MB) * 1024 * 1024 || 524288000, // 500MB
  },
  database: {
    batchSize: parseInt(process.env.DB_BATCH_SIZE) || 1000, // Records per batch insert
    mongoBatchSize: parseInt(process.env.MONGO_BATCH_SIZE) || 1000, // Documents per batch insert
  },
  json: {
    streamingThreshold: parseInt(process.env.JSON_STREAMING_THRESHOLD) || 10485760, // 10MB - use streaming for files larger than this
    streamingBatchSize: parseInt(process.env.JSON_STREAMING_BATCH_SIZE) || 10000, // Process in chunks during streaming
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
  rateLimit: {
    windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
    },
    ttl: {
      dataset: parseInt(process.env.CACHE_DATASET_TTL) || 3600, // 1 hour
      list: parseInt(process.env.CACHE_LIST_TTL) || 300, // 5 minutes
      search: parseInt(process.env.CACHE_SEARCH_TTL) || 300, // 5 minutes
      stats: parseInt(process.env.CACHE_STATS_TTL) || 900, // 15 minutes
    },
  },
};
