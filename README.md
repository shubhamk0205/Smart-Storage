# Smart Storage System

A full-stack intelligent storage system that accepts arbitrary files, auto-generates schemas, and provides a unified retrieval API.

## Project Structure

```
smart-storage-system/
├── backend/              # Node.js + Express backend
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic services
│   │   ├── utils/       # Utility functions
│   │   └── index.js     # Application entry point
│   ├── migrations/      # Database migrations
│   ├── uploads/         # Uploaded files storage
│   ├── package.json
│   ├── .env             # Environment configuration
│   └── README.md        # Backend documentation
├── frontend/            # Frontend application
└── .git/                # Git repository
```

## Features

- **Multi-format file upload**: Images, video, audio, JSON, NDJSON, and more
- **Automatic MIME detection**: Using the `file-type` npm package
- **Media pipeline**: Process media files with Sharp (images) and FFmpeg (video/audio)
- **JSON pipeline**: Handle structured data with automatic schema inference
- **Auto-schema generation**: Generate SQL DDL for PostgreSQL and JSON Schema for NoSQL
- **Dual database support**: PostgreSQL (via Knex) and MongoDB (via Mongoose)
- **Dataset cataloging**: Comprehensive metadata tracking
- **Unified retrieval API**: Always returns nested JSON regardless of storage backend

## Tech Stack

### Backend
- **Runtime**: Node.js >= 18
- **Framework**: Express.js
- **Databases**: PostgreSQL 12+, MongoDB 5+
- **File Processing**:
  - Multer (file uploads)
  - file-type (MIME detection)
  - Sharp (image processing)
  - FFmpeg (video/audio processing)
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate limiting

## Quick Start

### Prerequisites

1. Node.js >= 18
2. PostgreSQL >= 12
3. MongoDB >= 5
4. FFmpeg (for video/audio processing)

### Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npm run migrate:latest

# Start development server
npm run dev
```

The backend API will be available at `http://localhost:3000`

## API Endpoints

### File Upload
```
POST /api/upload
Content-Type: multipart/form-data
Body: file (multipart file upload)
```

### Dataset Management
```
GET    /api/datasets              # List all datasets
GET    /api/datasets/:id          # Get dataset metadata
GET    /api/datasets/:id/data     # Retrieve dataset data
POST   /api/datasets/:id/query    # Query dataset
GET    /api/datasets/:id/stats    # Get statistics
PATCH  /api/datasets/:id          # Update metadata
DELETE /api/datasets/:id          # Delete dataset
GET    /api/datasets/search/:keyword  # Search datasets
```

## Development

### Backend Development
```bash
cd backend
npm run dev
```

### Database Migrations
```bash
# Create new migration
npm run migrate:make migration_name

# Run migrations
npm run migrate:latest

# Rollback last migration
npm run migrate:rollback
```

## License

ISC
