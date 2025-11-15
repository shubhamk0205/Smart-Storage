# Docker Setup Script for Smart Storage (PowerShell)
# This script helps set up Docker containers and configure the backend

Write-Host "🐳 Smart Storage Docker Setup" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Check if docker-compose is available
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "❌ docker-compose is not installed. Please install Docker Compose." -ForegroundColor Red
    exit 1
}

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Join-Path $scriptPath "..\.."
Set-Location $projectRoot

# Start Docker containers
Write-Host ""
Write-Host "🚀 Starting Docker containers..." -ForegroundColor Yellow
docker-compose up -d

# Wait for containers to be healthy
Write-Host ""
Write-Host "⏳ Waiting for containers to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check container status
Write-Host ""
Write-Host "📊 Container Status:" -ForegroundColor Cyan
docker-compose ps

# Check PostgreSQL
Write-Host ""
Write-Host "🔍 Checking PostgreSQL..." -ForegroundColor Cyan
try {
    docker exec smart_storage_postgres pg_isready -U postgres | Out-Null
    Write-Host "✅ PostgreSQL is ready" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PostgreSQL is not ready yet. Wait a few seconds and try again." -ForegroundColor Yellow
}

# Check MongoDB
Write-Host ""
Write-Host "🔍 Checking MongoDB..." -ForegroundColor Cyan
try {
    docker exec smart_storage_mongodb mongosh --eval "db.adminCommand('ping')" -u admin -p admin --authenticationDatabase admin | Out-Null
    Write-Host "✅ MongoDB is ready" -ForegroundColor Green
} catch {
    Write-Host "⚠️  MongoDB is not ready yet. Wait a few seconds and try again." -ForegroundColor Yellow
}

# Copy Docker env file
Write-Host ""
Write-Host "📝 Setting up environment file..." -ForegroundColor Cyan
$dockerEnvPath = Join-Path $projectRoot "backend\.env.docker"
$envPath = Join-Path $projectRoot "backend\.env"

if (Test-Path $dockerEnvPath) {
    if (-not (Test-Path $envPath) -or $args[0] -eq "--force") {
        Copy-Item $dockerEnvPath $envPath -Force
        Write-Host "✅ Created backend/.env from .env.docker" -ForegroundColor Green
    } else {
        Write-Host "⚠️  backend/.env already exists. Use --force to overwrite." -ForegroundColor Yellow
        Write-Host "   Or manually update DATABASE_URL and MONGO_URI in backend/.env" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  backend/.env.docker not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Verify containers are running: docker-compose ps"
Write-Host "   2. Check logs: docker-compose logs"
Write-Host "   3. Start backend: cd backend; npm start"
Write-Host ""
Write-Host "📚 For more information, see DOCKER_SETUP.md" -ForegroundColor Cyan

