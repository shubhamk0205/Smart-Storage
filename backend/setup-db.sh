#!/bin/bash

echo "🚀 Setting up Smart Storage System Database..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install it first:"
    echo "   brew install postgresql@18"
    exit 1
fi

echo "✅ PostgreSQL is installed"

# Check if PostgreSQL is running
if ! pg_isready &> /dev/null; then
    echo "⚠️  PostgreSQL is not running. Starting it..."
    brew services start postgresql@18 || pg_ctl -D /opt/homebrew/var/postgresql@18 start
    sleep 2
fi

# Check again
if ! pg_isready &> /dev/null; then
    echo "❌ Could not start PostgreSQL. Please start it manually:"
    echo "   brew services start postgresql@18"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Create database
echo "📦 Creating database 'smart_storage'..."
createdb smart_storage 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database 'smart_storage' created"
else
    echo "ℹ️  Database 'smart_storage' may already exist"
fi

# Test connection
echo "🔌 Testing database connection..."
node test-db.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Add your Cloudinary credentials to .env file"
    echo "2. Run: npm run dev"
    echo "3. Test the /ingest endpoint with files!"
else
    echo "❌ Database connection test failed"
    exit 1
fi
