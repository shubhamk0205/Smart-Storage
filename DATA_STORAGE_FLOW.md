# 📊 Data Storage Flow - Where Everything is Stored

## Overview
This document explains where data and schemas are stored in the Smart Storage system.

## Storage Architecture

### 1. **Staging Files** (PostgreSQL - Temporary)
**Table:** `staging_files`
**Purpose:** Temporary storage for uploaded files before processing
**Contains:**
- File metadata (filename, size, SHA256, MIME type)
- File path on disk
- Processing status (pending, detected, processing, completed, error)
- **NOT permanent** - files are processed and moved to actual storage

### 2. **Dataset Catalog** (MongoDB - Permanent)
**Collection:** `datasets`
**Purpose:** Master catalog of all datasets with their schemas
**Contains:**
- Dataset metadata (name, ID, file path, size, category)
- **Schema information** (JSON Schema, SQL DDL, fields, table name)
- Storage backend (postgres/mongodb/file)
- Record count
- Processing status
- Timestamps

**Example Document Structure:**
```json
{
  "datasetId": "53ee7c71-36fe-4599-bd63-7da7bdbddb8b",
  "originalName": "nosql_data.json",
  "storage": "mongodb",
  "datasetSchema": {
    "jsonSchema": { ... },
    "sqlDDL": "CREATE TABLE ...",
    "tableName": "dataset_nosql_data_53ee7c71",
    "fields": [ ... ]
  },
  "recordCount": 1,
  "createdAt": "2025-11-15T18:26:03.734Z"
}
```

### 3. **Actual Data Storage**

#### For NoSQL (MongoDB):
**Collection:** `dataset_<datasetId>`
**Purpose:** Stores the actual JSON data
**Contains:**
- All records from the JSON file
- Each document includes `_datasetId` and `_importedAt` metadata

**Example:**
- Dataset ID: `53ee7c71-36fe-4599-bd63-7da7bdbddb8b`
- Collection: `dataset_53ee7c71-36fe-4599-bd63-7da7bdbddb8b`
- Contains: The actual JSON data (users, products, orders, etc.)

#### For SQL (PostgreSQL):
**Table:** `dataset_<name>_<shortId>`
**Purpose:** Stores tabular data in relational format
**Contains:**
- Flattened records from JSON
- Columns based on inferred schema

## Complete Flow for JSON File Upload

```
1. File Upload
   ↓
   [PostgreSQL: staging_files table]
   - Temporary record created
   - Status: "pending"
   
2. Detection
   ↓
   [PostgreSQL: staging_files table]
   - Status updated to "detected"
   - MIME type and file kind identified
   
3. JSON Processing
   ↓
   - Parse JSON file
   - Analyze structure
   - Generate schema (JSON Schema, SQL DDL, fields)
   
4. Data Storage Decision
   ↓
   ├─→ Nested/Complex Data → MongoDB
   │   └─→ Collection: dataset_<datasetId>
   │       └─→ Stores actual JSON data
   │
   └─→ Tabular Data → PostgreSQL
       └─→ Table: dataset_<name>_<shortId>
           └─→ Stores flattened records
   
5. Catalog Entry Creation
   ↓
   [MongoDB: datasets collection]
   - Complete dataset metadata
   - Schema information (JSON Schema, SQL DDL, fields)
   - Storage location reference
   - Status: "completed"
   
6. Staging Cleanup
   ↓
   [PostgreSQL: staging_files table]
   - Status updated to "completed"
   - File remains in staging for reference
```

## Key Points

### ✅ Schema Storage
- **Schema is stored in MongoDB `datasets` collection** (NOT in staging)
- Each dataset document contains:
  - `datasetSchema.jsonSchema` - JSON Schema definition
  - `datasetSchema.sqlDDL` - SQL DDL for PostgreSQL
  - `datasetSchema.tableName` - Table/collection name
  - `datasetSchema.fields` - Field definitions

### ✅ Data Storage
- **Actual data is in separate collections/tables:**
  - MongoDB: `dataset_<datasetId>` collection
  - PostgreSQL: `dataset_<name>_<shortId>` table

### ✅ Staging Table
- **Only for temporary file tracking**
- Does NOT contain schema
- Does NOT contain actual data
- Just tracks upload status and file metadata

## Collections/Tables Summary

### MongoDB Collections:
1. **`datasets`** - Catalog with schemas (permanent)
2. **`dataset_<uuid>`** - Actual data for each dataset (permanent)

### PostgreSQL Tables:
1. **`staging_files`** - Temporary upload tracking
2. **`dataset_<name>_<id>`** - Actual data for SQL datasets (if applicable)

## Verification Commands

### Check Dataset Catalog:
```bash
docker exec smart_storage_mongodb mongosh -u admin -p admin --authenticationDatabase admin smart_storage --eval "db.datasets.find().pretty()"
```

### Check Data Collection:
```bash
docker exec smart_storage_mongodb mongosh -u admin -p admin --authenticationDatabase admin smart_storage --eval "db.dataset_53ee7c71-36fe-4599-bd63-7da7bdbddb8b.find().limit(1).pretty()"
```

### Check Staging Table:
```bash
docker exec smart_storage_postgres psql -U postgres -d smart_storage -c "SELECT * FROM staging_files;"
```

## Conclusion

**The schema IS stored in the actual database (MongoDB `datasets` collection), NOT just in staging.**

- **Schema location:** MongoDB `datasets` collection (permanent)
- **Data location:** MongoDB `dataset_<datasetId>` collection or PostgreSQL table (permanent)
- **Staging location:** PostgreSQL `staging_files` table (temporary tracking only)

