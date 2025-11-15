# 🗄️ Database Names and Functionality

## Database Names

### PostgreSQL Database
**Name:** `smart_storage`
**Connection:** `localhost:5432` (Docker) or Supabase (if configured)

### MongoDB Database
**Name:** `smart_storage`
**Connection:** `localhost:27017` (Docker)

---

## PostgreSQL Database (`smart_storage`) - Functionality

### Purpose
Stores **SQL/relational data** and **temporary staging files**

### Tables and Their Functions:

#### 1. **`staging_files`** (Temporary)
**Purpose:** Tracks uploaded files before processing
**Contains:**
- File metadata (filename, size, SHA256 hash)
- File path on disk
- MIME type and file kind
- Processing status (pending, detected, processing, completed, error)
- Dataset name (if provided)
- **Note:** This is temporary - files are processed and moved to actual storage

#### 2. **`dataset_catalog`** (Permanent - NEW!)
**Purpose:** Catalog/metadata for **SQL datasets only**
**Contains:**
- Dataset ID, name, file path
- Schema information (JSON Schema, SQL DDL, fields)
- Storage backend (always 'postgres' for this table)
- Record count, metadata, processing status
- Tags, description, timestamps
- **Only SQL datasets are stored here**

#### 3. **`dataset_<name>_<id>`** (Permanent)
**Purpose:** Actual data tables for SQL datasets
**Contains:**
- Flattened JSON data stored as relational rows
- Columns based on inferred schema
- Example: `dataset_sql2_65f59e9a`, `dataset_sql3_12090a9b`

#### 4. **`media_<type>`** (Permanent)
**Purpose:** Metadata for media files (images, videos, audio)
**Tables:**
- `media_png` - PNG image metadata
- `media_mp4` - MP4 video metadata
- `media_json` - JSON file metadata (legacy, should be in catalog)
- Contains: Cloudinary URLs, dimensions, EXIF data, file info

---

## MongoDB Database (`smart_storage`) - Functionality

### Purpose
Stores **NoSQL/document data** and **NoSQL dataset catalogs**

### Collections and Their Functions:

#### 1. **`dataset_catalog`** (Permanent)
**Purpose:** Catalog/metadata for **NoSQL datasets only**
**Contains:**
- Dataset ID, name, file path
- Schema information (JSON Schema, SQL DDL, fields)
- Storage backend (always 'mongodb' for this collection)
- Record count, metadata, processing status
- Tags, description, timestamps
- **Only NoSQL datasets are stored here**

#### 2. **`dataset_<uuid>`** (Permanent)
**Purpose:** Actual data collections for NoSQL datasets
**Contains:**
- Complete JSON documents (preserves nested structure)
- Each document includes `_datasetId` and `_importedAt` metadata
- Example: `dataset_53ee7c71-36fe-4599-bd63-7da7bdbddb8b`
- Stores the entire JSON structure as-is

---

## Complete Database Structure

### PostgreSQL (`smart_storage`)
```
smart_storage (database)
├── staging_files (table)              ← Temporary file tracking
├── dataset_catalog (table)            ← SQL dataset metadata
├── dataset_<name>_<id> (tables)        ← SQL dataset data
└── media_<type> (tables)              ← Media file metadata
```

### MongoDB (`smart_storage`)
```
smart_storage (database)
├── dataset_catalog (collection)       ← NoSQL dataset metadata
└── dataset_<uuid> (collections)       ← NoSQL dataset data
```

---

## Data Flow by Type

### SQL Datasets (Tabular Data):
```
1. Upload → staging_files (PostgreSQL)
2. Process → dataset_<name>_<id> (PostgreSQL) ← Actual data
3. Catalog → dataset_catalog (PostgreSQL)      ← Metadata
```

### NoSQL Datasets (Nested/Complex Data):
```
1. Upload → staging_files (PostgreSQL)
2. Process → dataset_<uuid> (MongoDB)         ← Actual data
3. Catalog → dataset_catalog (MongoDB)          ← Metadata
```

### Media Files:
```
1. Upload → staging_files (PostgreSQL)
2. Process → Cloudinary (cloud storage)
3. Catalog → media_<type> (PostgreSQL)         ← Metadata
```

---

## Summary

### Database Names:
- **PostgreSQL:** `smart_storage`
- **MongoDB:** `smart_storage`

### Key Separation:
- ✅ **SQL datasets** → PostgreSQL (both catalog and data)
- ✅ **NoSQL datasets** → MongoDB (both catalog and data)
- ✅ **Staging files** → PostgreSQL (temporary)
- ✅ **Media metadata** → PostgreSQL

### Why Both Databases?
- **PostgreSQL:** Best for structured, tabular data and SQL queries
- **MongoDB:** Best for nested, complex JSON structures and flexible schemas

Both databases work together to provide the optimal storage solution for different data types! 🎯

