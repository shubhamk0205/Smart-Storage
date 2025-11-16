# Redis Caching Implementation Plan

## Overview
This document outlines the strategy for implementing Redis caching to improve performance and reduce database load for frequently accessed dataset metadata.

---

## 1. What Will Be Cached

### Primary Cache Targets (High Priority)
1. **Individual Dataset Metadata** (`getDataset(datasetId)`)
   - Most frequently accessed
   - Cache key: `dataset:{datasetId}`
   - TTL: 1 hour (3600 seconds)

2. **Dataset List with Filters** (`listDatasets(filters, options)`)
   - Frequently accessed (frontend dashboard)
   - Cache key: `datasets:list:{filters_hash}:{options_hash}`
   - TTL: 5 minutes (300 seconds) - shorter because lists change more often

3. **Dataset Search Results** (`searchDatasets(keyword)`)
   - Cache key: `datasets:search:{keyword_hash}`
   - TTL: 5 minutes (300 seconds)

### Secondary Cache Targets (Medium Priority)
4. **Dataset Statistics** (`getDatasetStats(datasetId)`)
   - Cache key: `dataset:{datasetId}:stats`
   - TTL: 15 minutes (900 seconds) - stats change less frequently

---

## 2. Architecture & Flow

### 2.1 Cache Layer Structure
```
┌─────────────────┐
│   API Routes    │
│ (dataset.routes)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Catalog Service │  ← Cache wrapper added here
│  (catalog.js)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │        │
    ▼        ▼
┌────────┐ ┌──────────┐
│ Redis  │ │ Database │
│ Cache  │ │ (PG/Mongo)│
└────────┘ └──────────┘
```

### 2.2 Cache Read Flow (Cache-Aside Pattern)
```
1. Request: GET /api/datasets/{datasetId}
   │
   ▼
2. Check Redis Cache
   │
   ├─► Cache HIT?
   │   └─► Return cached data (fast path)
   │
   └─► Cache MISS?
       │
       ▼
3. Query Database (PostgreSQL or MongoDB)
   │
   ▼
4. Store in Redis Cache (with TTL)
   │
   ▼
5. Return data to client
```

### 2.3 Cache Write Flow (Write-Through Pattern)
```
1. Request: POST /api/ingest/upload (creates dataset)
   │
   ▼
2. Create dataset in Database
   │
   ▼
3. Invalidate related cache keys:
   - `dataset:{datasetId}` (if exists)
   - `datasets:list:*` (all list caches)
   - `datasets:search:*` (all search caches)
   │
   ▼
4. Optionally: Warm cache with new dataset
   │
   ▼
5. Return response
```

---

## 3. Cache Key Naming Strategy

### Pattern: `{prefix}:{identifier}:{subkey?}`

| Operation | Cache Key Pattern | Example |
|-----------|------------------|---------|
| Get Dataset | `dataset:{datasetId}` | `dataset:abc123-def456` |
| List Datasets | `datasets:list:{filters_hash}:{options_hash}` | `datasets:list:a1b2c3:d4e5f6` |
| Search Datasets | `datasets:search:{keyword_hash}` | `datasets:search:7f8a9b` |
| Dataset Stats | `dataset:{datasetId}:stats` | `dataset:abc123-def456:stats` |

### Hash Generation
- **Filters hash**: `md5(JSON.stringify(filters))` → first 8 chars
- **Options hash**: `md5(JSON.stringify(options))` → first 8 chars
- **Keyword hash**: `md5(keyword.toLowerCase())` → first 8 chars

**Example:**
```javascript
// Filters: { storage: 'postgres' }
// Options: { page: 1, limit: 100 }
// Cache key: `datasets:list:a1b2c3d4:e5f6g7h8`
```

---

## 4. Cache Invalidation Strategy

### 4.1 When to Invalidate

| Operation | Cache Keys to Invalidate |
|-----------|-------------------------|
| `createDataset()` | - `datasets:list:*` (all list caches)<br>- `datasets:search:*` (all search caches) |
| `updateDataset()` | - `dataset:{datasetId}`<br>- `dataset:{datasetId}:stats`<br>- `datasets:list:*`<br>- `datasets:search:*` |
| `deleteDataset()` | - `dataset:{datasetId}`<br>- `dataset:{datasetId}:stats`<br>- `datasets:list:*`<br>- `datasets:search:*` |

### 4.2 Invalidation Methods

**Option A: Pattern-Based Deletion (Recommended)**
```javascript
// Delete all keys matching pattern
await redis.keys('datasets:list:*').then(keys => {
  if (keys.length > 0) redis.del(...keys);
});
```

**Option B: Tag-Based Invalidation (Advanced)**
- Add tags to cache keys: `dataset:{datasetId}:tags:list,search`
- When invalidating, find all keys with specific tag
- More complex but more precise

**We'll use Option A for simplicity.**

---

## 5. Implementation Details

### 5.1 Files to Modify

1. **`backend/src/config/redis.config.js`** (NEW)
   - Redis client initialization
   - Connection handling
   - Error handling

2. **`backend/src/services/cache.service.js`** (NEW)
   - Cache wrapper functions
   - Key generation utilities
   - Invalidation helpers

3. **`backend/src/services/catalog.service.js`** (MODIFY)
   - Add cache layer to:
     - `getDataset()`
     - `listDatasets()`
     - `searchDatasets()`
   - Add invalidation to:
     - `createDataset()`
     - `updateDataset()`
     - `deleteDataset()`

4. **`backend/src/config/app.config.js`** (MODIFY)
   - Add Redis configuration

5. **`backend/package.json`** (MODIFY)
   - Add `ioredis` dependency

6. **`backend/src/index.js`** (MODIFY)
   - Initialize Redis connection on startup

### 5.2 Code Structure

#### Cache Service (`cache.service.js`)
```javascript
class CacheService {
  // Get from cache
  async get(key) { }
  
  // Set in cache with TTL
  async set(key, value, ttl) { }
  
  // Delete single key
  async del(key) { }
  
  // Delete keys by pattern
  async delPattern(pattern) { }
  
  // Generate cache keys
  generateDatasetKey(datasetId) { }
  generateListKey(filters, options) { }
  generateSearchKey(keyword) { }
  generateStatsKey(datasetId) { }
}
```

#### Catalog Service Modifications
```javascript
async getDataset(datasetId) {
  // 1. Check cache
  const cacheKey = cacheService.generateDatasetKey(datasetId);
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    logger.debug(`Cache HIT: ${cacheKey}`);
    return cached;
  }
  
  // 2. Cache MISS - fetch from DB
  logger.debug(`Cache MISS: ${cacheKey}`);
  const dataset = await this.fetchFromDatabase(datasetId);
  
  // 3. Store in cache
  if (dataset) {
    await cacheService.set(cacheKey, dataset, 3600); // 1 hour
  }
  
  return dataset;
}
```

---

## 6. Configuration

### 6.1 Environment Variables
```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional
REDIS_DB=0

# Cache TTLs (in seconds)
CACHE_DATASET_TTL=3600        # 1 hour
CACHE_LIST_TTL=300            # 5 minutes
CACHE_SEARCH_TTL=300          # 5 minutes
CACHE_STATS_TTL=900           # 15 minutes

# Cache Settings
CACHE_ENABLED=true            # Feature flag
CACHE_MAX_KEYS=10000          # Max keys to store
```

### 6.2 App Config
```javascript
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
    dataset: parseInt(process.env.CACHE_DATASET_TTL) || 3600,
    list: parseInt(process.env.CACHE_LIST_TTL) || 300,
    search: parseInt(process.env.CACHE_SEARCH_TTL) || 300,
    stats: parseInt(process.env.CACHE_STATS_TTL) || 900,
  },
}
```

---

## 7. Error Handling & Fallback

### 7.1 Redis Connection Failure
- **Strategy**: Graceful degradation
- **Behavior**: If Redis is unavailable, skip caching and query database directly
- **Logging**: Warn but don't fail the request

```javascript
async get(key) {
  try {
    return await redis.get(key);
  } catch (error) {
    logger.warn('Redis cache error (falling back to DB):', error);
    return null; // Cache miss - will query DB
  }
}
```

### 7.2 Cache Serialization Errors
- Handle JSON parse/stringify errors
- Log error and fall back to database query

---

## 8. Performance Considerations

### 8.1 Expected Improvements
- **`getDataset()`**: 50-100ms → 1-5ms (95% faster)
- **`listDatasets()`**: 200-500ms → 5-10ms (95% faster)
- **Database load**: Reduced by ~70-80% for read operations

### 8.2 Memory Usage
- Average dataset metadata: ~2-5KB
- 1000 cached datasets: ~2-5MB
- List cache entries: ~10-50KB each
- **Total estimated**: ~10-50MB for typical usage

### 8.3 Cache Warming (Optional)
- On server startup, pre-load frequently accessed datasets
- Can be implemented later if needed

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Cache hit/miss scenarios
- Cache invalidation
- Error handling (Redis down)

### 9.2 Integration Tests
- End-to-end flow with Redis
- Fallback behavior when Redis unavailable

### 9.3 Performance Tests
- Compare response times with/without cache
- Load testing with cache enabled

---

## 10. Implementation Steps

### Phase 1: Setup (Foundation)
1. ✅ Install `ioredis` package
2. ✅ Create `redis.config.js` (Redis client initialization)
3. ✅ Create `cache.service.js` (Cache wrapper)
4. ✅ Add Redis config to `app.config.js`
5. ✅ Initialize Redis connection in `index.js`

### Phase 2: Core Caching (Read Operations)
6. ✅ Add caching to `getDataset()`
7. ✅ Add caching to `listDatasets()`
8. ✅ Add caching to `searchDatasets()`

### Phase 3: Cache Invalidation (Write Operations)
9. ✅ Add invalidation to `createDataset()`
10. ✅ Add invalidation to `updateDataset()`
11. ✅ Add invalidation to `deleteDataset()`

### Phase 4: Optional Enhancements
12. ⏳ Add caching to `getDatasetStats()` (if needed)
13. ⏳ Add cache metrics/logging
14. ⏳ Add cache warming on startup (if needed)

---

## 11. Monitoring & Observability

### 11.1 Metrics to Track
- Cache hit rate (target: >80%)
- Cache miss rate
- Average response time (with/without cache)
- Redis connection status
- Memory usage

### 11.2 Logging
- Cache hits/misses (debug level)
- Cache invalidation events (info level)
- Redis errors (warn level)

---

## 12. Rollout Plan

### Step 1: Development
- Implement in development environment
- Test with sample data
- Verify cache behavior

### Step 2: Staging
- Deploy to staging
- Monitor cache performance
- Test fallback behavior

### Step 3: Production (Gradual)
- Enable with feature flag (`CACHE_ENABLED=true`)
- Monitor for 24-48 hours
- Gradually increase cache TTLs if stable

---

## 13. Future Enhancements

1. **Cache Compression**: Compress large cache values
2. **Distributed Caching**: Redis Cluster for high availability
3. **Cache Analytics**: Dashboard for cache performance
4. **Smart Invalidation**: More granular invalidation strategies
5. **Cache Preloading**: Predict and preload frequently accessed data

---

## Summary

This implementation will:
- ✅ Reduce database load by 70-80%
- ✅ Improve API response times by 95%
- ✅ Scale better under high traffic
- ✅ Gracefully degrade if Redis fails
- ✅ Be configurable via environment variables
- ✅ Support easy rollback via feature flag

**Estimated Implementation Time**: 2-3 hours
**Risk Level**: Low (with graceful fallback)
**Impact**: High (significant performance improvement)

