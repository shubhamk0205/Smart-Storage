# 🐳 Docker Setup Guide

This guide will help you set up PostgreSQL and MongoDB using Docker for the Smart Storage application.

## 📋 Prerequisites

- Docker Desktop installed and running
- Docker Compose installed (comes with Docker Desktop)

## 🚀 Quick Start

### 1. Start Docker Containers

```bash
# Start both PostgreSQL and MongoDB
docker-compose up -d

# Or start only PostgreSQL
docker-compose up -d postgres

# Or start only MongoDB
docker-compose up -d mongodb
```

### 2. Check Container Status

```bash
# Check if containers are running
docker-compose ps

# View logs
docker-compose logs postgres
docker-compose logs mongodb

# Follow logs in real-time
docker-compose logs -f postgres
```

### 3. Update Backend Configuration

Copy the Docker environment file:

```bash
cd backend
cp .env.docker .env
```

Or manually update your `.env` file with:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_storage
MONGO_URI=mongodb://admin:admin@localhost:27017/smart_storage?authSource=admin
```

### 4. Start Backend Server

```bash
cd backend
npm install  # If not already done
npm start
```

## 🔧 Container Management

### Start Containers
```bash
docker-compose up -d
```

### Stop Containers
```bash
docker-compose down
```

### Stop and Remove Volumes (⚠️ Deletes all data)
```bash
docker-compose down -v
```

### Restart Containers
```bash
docker-compose restart
```

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs postgres
docker-compose logs mongodb

# Follow logs
docker-compose logs -f
```

## 🗄️ Database Access

### PostgreSQL

**Connection Details:**
- Host: `localhost`
- Port: `5432`
- Database: `smart_storage`
- Username: `postgres`
- Password: `postgres`

**Using psql:**
```bash
docker exec -it smart_storage_postgres psql -U postgres -d smart_storage
```

**Using pgAdmin or DBeaver:**
- Host: `localhost`
- Port: `5432`
- Database: `smart_storage`
- Username: `postgres`
- Password: `postgres`

### MongoDB

**Connection Details:**
- Host: `localhost`
- Port: `27017`
- Database: `smart_storage`
- Username: `admin`
- Password: `admin`
- Auth Source: `admin`

**Using mongosh:**
```bash
docker exec -it smart_storage_mongodb mongosh -u admin -p admin --authenticationDatabase admin
```

**Using MongoDB Compass:**
```
mongodb://admin:admin@localhost:27017/smart_storage?authSource=admin
```

## 📊 Database Volumes

Data is persisted in Docker volumes:

- **PostgreSQL**: `postgres_data`
- **MongoDB**: `mongodb_data`

To view volumes:
```bash
docker volume ls
```

To inspect a volume:
```bash
docker volume inspect smart_storage_postgres_data
```

## 🔄 Reset Databases

### Reset PostgreSQL (⚠️ Deletes all data)
```bash
docker-compose down -v postgres
docker-compose up -d postgres
```

### Reset MongoDB (⚠️ Deletes all data)
```bash
docker-compose down -v mongodb
docker-compose up -d mongodb
```

### Reset Both (⚠️ Deletes all data)
```bash
docker-compose down -v
docker-compose up -d
```

## 🛠️ Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Check container status
docker-compose ps

# Restart containers
docker-compose restart
```

### Port already in use
If port 5432 or 27017 is already in use:

1. **Option 1**: Stop the existing service using that port
2. **Option 2**: Change ports in `docker-compose.yml`:
   ```yaml
   ports:
     - "5433:5432"  # Use 5433 instead of 5432
   ```
   Then update `.env`:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/smart_storage
   ```

### Connection refused
```bash
# Check if containers are running
docker-compose ps

# Check if containers are healthy
docker-compose ps --format json | grep health

# Restart containers
docker-compose restart
```

### Reset everything
```bash
# Stop and remove everything
docker-compose down -v

# Remove images (optional)
docker rmi postgres:16-alpine mongo:7

# Start fresh
docker-compose up -d
```

## 📝 Environment Variables

### PostgreSQL Environment Variables
- `POSTGRES_USER`: Database user (default: `postgres`)
- `POSTGRES_PASSWORD`: Database password (default: `postgres`)
- `POSTGRES_DB`: Database name (default: `smart_storage`)

### MongoDB Environment Variables
- `MONGO_INITDB_ROOT_USERNAME`: Root username (default: `admin`)
- `MONGO_INITDB_ROOT_PASSWORD`: Root password (default: `admin`)
- `MONGO_INITDB_DATABASE`: Initial database (default: `smart_storage`)

To change these, edit `docker-compose.yml` and update your `.env` file accordingly.

## 🔒 Security Notes

⚠️ **Important**: The default passwords are for development only!

For production:
1. Change all default passwords
2. Use Docker secrets or environment variable files
3. Don't expose ports publicly
4. Use Docker networks for service communication

## 📚 Additional Commands

### Execute SQL in PostgreSQL
```bash
docker exec -i smart_storage_postgres psql -U postgres -d smart_storage < script.sql
```

### Backup PostgreSQL
```bash
docker exec smart_storage_postgres pg_dump -U postgres smart_storage > backup.sql
```

### Restore PostgreSQL
```bash
docker exec -i smart_storage_postgres psql -U postgres -d smart_storage < backup.sql
```

### Backup MongoDB
```bash
docker exec smart_storage_mongodb mongodump -u admin -p admin --authenticationDatabase admin --db smart_storage --out /data/backup
```

### View Container Resource Usage
```bash
docker stats smart_storage_postgres smart_storage_mongodb
```

## ✅ Verification

After starting containers, verify they're working:

```bash
# Check PostgreSQL
docker exec smart_storage_postgres pg_isready -U postgres

# Check MongoDB
docker exec smart_storage_mongodb mongosh --eval "db.adminCommand('ping')" -u admin -p admin --authenticationDatabase admin
```

## 🎯 Next Steps

1. ✅ Start Docker containers: `docker-compose up -d`
2. ✅ Update `.env` file with Docker connection strings
3. ✅ Start backend: `cd backend && npm start`
4. ✅ Verify connections in backend logs

Your Smart Storage application is now running with Docker PostgreSQL and MongoDB! 🎉

