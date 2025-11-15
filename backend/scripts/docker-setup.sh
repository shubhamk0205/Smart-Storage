#!/bin/bash

# Docker Setup Script for Smart Storage
# This script helps set up Docker containers and configure the backend

echo "🐳 Smart Storage Docker Setup"
echo "=============================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker Compose is available"
echo ""

# Navigate to project root
cd "$(dirname "$0")/../.."

# Start Docker containers
echo "🚀 Starting Docker containers..."
docker-compose up -d

# Wait for containers to be healthy
echo ""
echo "⏳ Waiting for containers to be ready..."
sleep 5

# Check container status
echo ""
echo "📊 Container Status:"
docker-compose ps

# Check PostgreSQL
echo ""
echo "🔍 Checking PostgreSQL..."
if docker exec smart_storage_postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "⚠️  PostgreSQL is not ready yet. Wait a few seconds and try again."
fi

# Check MongoDB
echo ""
echo "🔍 Checking MongoDB..."
if docker exec smart_storage_mongodb mongosh --eval "db.adminCommand('ping')" -u admin -p admin --authenticationDatabase admin > /dev/null 2>&1; then
    echo "✅ MongoDB is ready"
else
    echo "⚠️  MongoDB is not ready yet. Wait a few seconds and try again."
fi

# Copy Docker env file
echo ""
echo "📝 Setting up environment file..."
if [ -f "backend/.env.docker" ]; then
    if [ ! -f "backend/.env" ] || [ "$1" == "--force" ]; then
        cp backend/.env.docker backend/.env
        echo "✅ Created backend/.env from .env.docker"
    else
        echo "⚠️  backend/.env already exists. Use --force to overwrite."
        echo "   Or manually update DATABASE_URL and MONGO_URI in backend/.env"
    fi
else
    echo "⚠️  backend/.env.docker not found"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify containers are running: docker-compose ps"
echo "   2. Check logs: docker-compose logs"
echo "   3. Start backend: cd backend && npm start"
echo ""
echo "📚 For more information, see DOCKER_SETUP.md"

