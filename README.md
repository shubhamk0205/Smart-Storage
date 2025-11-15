# Smart Storage System

A production-ready Node.js + Express system that accepts arbitrary files, auto-generates schemas, and provides a unified retrieval API.

## Features

- Multi-format file upload (images, video, audio, JSON, NDJSON, unknown)
- Automatic MIME type detection using `file-type`
- Media pipeline for processing media files
- JSON pipeline for structured data
- Auto-schema generation (SQL DDL for PostgreSQL, JSON Schema for NoSQL)
- Automatic data loading into PostgreSQL or MongoDB
- Dataset cataloging
- Unified retrieval API (always returns nested JSON)

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 12
- MongoDB >= 5
- FFmpeg (for video/audio processing)

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`
2. Update database credentials and other settings
3. Create PostgreSQL and MongoDB databases

## Database Setup

Run PostgreSQL migrations:

```bash
npm run migrate:latest
```

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Upload File
```
POST /api/upload
Content-Type: multipart/form-data

Body: file (multipart file upload)
```

### Retrieve Data
```
GET /api/datasets/:datasetId
```

### List All Datasets
```
GET /api/datasets
```

## Project Structure

```
smart-storage-system/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── index.js         # Application entry point
├── migrations/          # Database migrations
├── uploads/             # Uploaded files
├── logs/                # Application logs
└── package.json
```

## License

ISC
