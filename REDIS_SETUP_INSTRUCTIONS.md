# Redis Caching Setup Instructions

## Enable Redis Caching

Add the following to your `backend/.env` file:

```env
# Enable Redis caching
CACHE_ENABLED=true

# Redis connection (choose one option)

# Option 1: Use Redis URL (recommended)
REDIS_URL=redis://localhost:6379

# Option 2: Use individual settings
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=
# REDIS_DB=0

# Cache TTLs (in seconds) - Optional, defaults shown
CACHE_DATASET_TTL=3600    # 1 hour for individual datasets
CACHE_LIST_TTL=300        # 5 minutes for dataset lists
CACHE_SEARCH_TTL=300      # 5 minutes for search results
CACHE_STATS_TTL=900       # 15 minutes for statistics
```

## Start Redis Server

### Option 1: Using Docker (Recommended)
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### Option 2: Install Redis Locally

**Windows:**
- Download from: https://github.com/microsoftarchive/redis/releases
- Or use WSL: `sudo apt-get install redis-server`

**Mac:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

## Verify Redis is Running

```bash
# Test connection
redis-cli ping
# Should return: PONG
```

## Restart Your Backend

After adding the environment variables, restart your backend server:

```bash
cd backend
npm start
```

You should see:
```
✅ Redis connected successfully!
   Host: localhost:6379, DB: 0
   Caching enabled and ready
```

## Troubleshooting

### If Redis connection fails:
1. Make sure Redis is running: `redis-cli ping`
2. Check the port (default is 6379)
3. Verify firewall settings
4. The server will continue without caching if Redis is unavailable (graceful degradation)

### If you see "Redis caching is disabled":
- Make sure `CACHE_ENABLED=true` (not `false` or missing)
- Restart the server after changing `.env`

