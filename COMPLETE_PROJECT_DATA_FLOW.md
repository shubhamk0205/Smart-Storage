# 📚 Complete Project Data Flow & Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Complete Data Flow](#complete-data-flow)
3. [JSON Classification Criteria (SQL vs NoSQL)](#json-classification-criteria)
4. [Schema Generation Process](#schema-generation-process)
5. [Storage Mechanisms](#storage-mechanisms)
6. [File Processing Pipelines](#file-processing-pipelines)
7. [Code References](#code-references)

---

## System Overview

### Architecture
EZ_store is a smart storage application that automatically:
- **Detects** file types (JSON, images, videos, audio, etc.)
- **Classifies** JSON data into SQL or NoSQL storage
- **Generates** schemas (SQL DDL, JSON Schema)
- **Stores** data in optimal databases (PostgreSQL or MongoDB)
- **Catalogs** all datasets for easy retrieval

### Key Components
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Node.js + Express.js
- **Databases:** PostgreSQL (SQL) + MongoDB (NoSQL)
- **Storage:** Cloudinary (media files)
- **Processing:** JSON Pipeline, Media Pipeline

---

## Complete Data Flow

### High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FILE UPLOAD (Frontend)                        │
│              POST /api/ingest/upload                             │
│              - Single or Multiple Files                          │
│              - Optional Dataset Name                             │
│              - Auto-process Flag                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              STAGING (PostgreSQL)                                │
│         Table: staging_files                                     │
│                                                                  │
│         Fields:                                                  │
│         - id (SERIAL PRIMARY KEY)                                │
│         - original_filename (VARCHAR)                            │
│         - file_path (TEXT)                                       │
│         - size_bytes (BIGINT)                                    │
│         - sha256 (VARCHAR)                                       │
│         - status (VARCHAR): 'pending' → 'detected' → ...        │
│         - mime_type (VARCHAR)                                    │
│         - file_kind (VARCHAR): 'json', 'image', 'video', etc.   │
│         - dataset_name (VARCHAR, nullable)                      │
│         - created_at (TIMESTAMP)                                 │
│                                                                  │
│         Status Flow:                                             │
│         pending → detected → processing → completed/error        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              FILE TYPE DETECTION                                 │
│         detectionService.detectAndClassify()                     │
│                                                                  │
│         Detection Methods (Priority Order):                      │
│         1. File Extension (for text files like JSON)             │
│         2. Magic Bytes (binary signatures)                       │
│         3. Content Analysis (fallback)                           │
│                                                                  │
│         Returns:                                                 │
│         - mimeType: 'application/json', 'image/png', etc.       │
│         - fileKind: 'json', 'image', 'video', 'audio', 'unknown' │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────┴─────────────┐
         │                          │
         ▼                          ▼
┌──────────────────┐      ┌──────────────────┐
│   JSON FILES     │      │   MEDIA FILES   │
│   (json, ndjson) │      │ (image, video,  │
│                  │      │     audio)      │
└────────┬─────────┘      └────────┬────────┘
         │                          │
         ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│         JSON PROCESSING PIPELINE                                  │
│         (See detailed flow below)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## JSON Classification Criteria (SQL vs NoSQL)

### Decision Algorithm

**Location:** `backend/src/jsonPipeline/json.orchestrator.js:163-170`

```javascript
determineBackend(analysis) {
  // Simple heuristic: use SQL for tabular data, NoSQL for nested/complex
  if (analysis.fields) {
    const hasNested = Object.values(analysis.fields).some(f => f.nested);
    return hasNested ? 'nosql' : 'sql';
  }
  return 'sql';
}
```

### Detailed Classification Logic

#### Step 1: JSON Structure Analysis

**Location:** `backend/src/services/json-pipeline.service.js:195-219`

The system analyzes the JSON structure:

```javascript
analyzeJsonStructure(data) {
  if (Array.isArray(data)) {
    // Array of objects - analyze first 10 records
    const sample = data.slice(0, Math.min(10, data.length));
    const fields = this.extractFields(sample);
    return {
      type: 'array',
      itemCount: data.length,
      fields,  // Field definitions from sample
    };
  } else if (typeof data === 'object' && data !== null) {
    // Single object - analyze its properties
    const fields = this.extractFields([data]);
    return {
      type: 'object',
      fields,
    };
  }
  return { type: typeof data };
}
```

#### Step 2: Field Extraction

**Location:** `backend/src/services/json-pipeline.service.js:226-271`

For each field, the system determines:

```javascript
extractFields(sample) {
  const fieldTypes = {};
  
  for (const record of sample) {
    for (const [key, value] of Object.entries(record)) {
      if (!fieldTypes[key]) {
        fieldTypes[key] = {
          types: new Set(),      // All types seen for this field
          nullable: false,        // Can be null/undefined?
          nested: false,         // Contains nested structures?
        };
      }
      
      if (value === null || value === undefined) {
        fieldTypes[key].nullable = true;
      } else {
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        fieldTypes[key].types.add(valueType);
        
        // Mark as nested if object or array
        if (valueType === 'object' || valueType === 'array') {
          fieldTypes[key].nested = true;
          if (valueType === 'object') {
            // Recursively extract nested fields
            fieldTypes[key].nestedFields = this.extractFields([value]);
          }
        }
      }
    }
  }
  
  return fieldTypes;  // Convert Sets to Arrays for JSON
}
```

#### Step 3: Nested Detection

**Key Criteria:** A field is marked as `nested: true` if:
- The field value is an **object** (`typeof value === 'object'`)
- The field value is an **array** (`Array.isArray(value)`)

**Examples:**

**Example 1: SQL Classification (No Nested Fields)**
```json
[
  { "id": 1, "name": "John", "age": 30, "active": true },
  { "id": 2, "name": "Jane", "age": 25, "active": false }
]
```

**Field Analysis:**
- `id`: types: ['number'], nested: false
- `name`: types: ['string'], nested: false
- `age`: types: ['number'], nested: false
- `active`: types: ['boolean'], nested: false

**Result:** `hasNested = false` → **SQL (PostgreSQL)**

---

**Example 2: NoSQL Classification (Has Nested Fields)**
```json
{
  "users": [
    { "id": 1, "name": { "first": "John", "last": "Doe" }, "roles": ["admin", "user"] }
  ],
  "products": [
    { "id": 1, "specs": { "color": "red", "size": "L" } }
  ]
}
```

**Field Analysis:**
- `users`: types: ['array'], nested: **true** ← Array detected
- `products`: types: ['array'], nested: **true** ← Array detected

**Result:** `hasNested = true` → **NoSQL (MongoDB)**

---

**Example 3: NoSQL Classification (Nested Objects)**
```json
[
  {
    "id": 1,
    "address": { "street": "123 Main", "city": "NYC" },  // ← Nested object
    "tags": ["tag1", "tag2"]  // ← Array
  }
]
```

**Field Analysis:**
- `id`: types: ['number'], nested: false
- `address`: types: ['object'], nested: **true** ← Object detected
- `tags`: types: ['array'], nested: **true** ← Array detected

**Result:** `hasNested = true` → **NoSQL (MongoDB)**

---

### Classification Decision Tree

```
JSON File Uploaded
    │
    ▼
Parse JSON File
    │
    ▼
Analyze Structure
    │
    ├─→ Array of Objects?
    │   │
    │   └─→ Extract fields from sample (first 10 records)
    │
    └─→ Single Object?
        │
        └─→ Extract fields from object properties
    │
    ▼
For Each Field:
    │
    ├─→ Is value an object? → nested = true
    ├─→ Is value an array? → nested = true
    └─→ Is value primitive? → nested = false
    │
    ▼
Check All Fields:
    │
    ├─→ ANY field has nested = true?
    │   │
    │   ├─→ YES → NoSQL (MongoDB)
    │   │
    │   └─→ NO → SQL (PostgreSQL)
    │
    ▼
Storage Decision Complete
```

### Edge Cases

1. **Empty Arrays:**
   - If array is empty → Defaults to SQL
   - Cannot determine structure → Safe default

2. **Mixed Types:**
   - If field has both primitive and nested values → `nested = true`
   - Example: `{ "data": "string" }` and `{ "data": { "nested": true } }` → NoSQL

3. **Null Values:**
   - Null values don't affect nested detection
   - Only actual object/array values mark as nested

4. **Top-Level Array vs Object:**
   - Array of objects: Analyzes each object in array
   - Single object: Analyzes object properties directly
   - Both use same nested detection logic

---

## Schema Generation Process

### Overview

The system generates **three types of schemas** for every JSON file:

1. **SQL DDL** - PostgreSQL table definition
2. **JSON Schema** - Standard JSON Schema (draft-07)
3. **Fields Array** - Simplified field definitions

**Location:** `backend/src/jsonPipeline/json.orchestrator.js:21-27`

```javascript
// Generate schemas (for ALL datasets, regardless of storage)
const datasetId = uuidv4();
const tableName = schemaGenerator.generateTableName(finalDatasetName, datasetId);
const fieldsObj = processingResult.analysis.fields || {};
const fields = this.convertFieldsToSchema(fieldsObj);
const ddl = schemaGenerator.generatePostgresDDL(tableName, fieldsObj);
const jsonSchema = schemaGenerator.generateJsonSchema(fieldsObj);
```

### Step 1: Table Name Generation

**Location:** `backend/src/services/schema-generator.service.js:178-185`

```javascript
generateTableName(originalName, datasetId) {
  const baseName = originalName
    .replace(/\.[^/.]+$/, '')  // Remove file extension
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');  // Replace special chars with underscore
  
  const shortId = datasetId.substring(0, 8);  // First 8 chars of UUID
  
  return `dataset_${this.sanitizeIdentifier(baseName)}_${shortId}`;
}
```

**Example:**
- File: `sql3.json`
- UUID: `53ee7c71-36fe-4599-bd63-7da7bdbddb8b`
- Result: `dataset_sql3_53ee7c71`

---

### Step 2: SQL DDL Generation

**Location:** `backend/src/services/schema-generator.service.js:15-30`

#### Process:

```javascript
generatePostgresDDL(tableName, fields) {
  // Always include these columns
  const columns = [
    'id SERIAL PRIMARY KEY',
    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  ];

  // Add column for each field
  for (const [fieldName, fieldInfo] of Object.entries(fields)) {
    const columnName = this.sanitizeIdentifier(fieldName);
    const columnType = this.mapToPostgresType(fieldInfo);
    const nullable = fieldInfo.nullable ? '' : ' NOT NULL';

    columns.push(`${columnName} ${columnType}${nullable}`);
  }

  return `CREATE TABLE IF NOT EXISTS ${this.sanitizeIdentifier(tableName)} (\n  ${columns.join(',\n  ')}\n);`;
}
```

#### Type Mapping

**Location:** `backend/src/services/schema-generator.service.js:37-67`

```javascript
mapToPostgresType(fieldInfo) {
  const types = fieldInfo.types || [];

  // Priority 1: Nested structures → JSONB
  if (fieldInfo.nested) {
    return 'JSONB';
  }

  // Priority 2: Multiple types → Use most permissive
  if (types.length > 1) {
    if (types.includes('string')) return 'TEXT';
    if (types.includes('number')) return 'DOUBLE PRECISION';
    return 'JSONB';
  }

  // Priority 3: Single type mapping
  const type = types[0];
  switch (type) {
    case 'string':  return 'TEXT';
    case 'number':  return 'DOUBLE PRECISION';
    case 'boolean': return 'BOOLEAN';
    case 'object':  return 'JSONB';
    case 'array':   return 'JSONB';
    default:        return 'TEXT';
  }
}
```

**Type Mapping Table:**

| JavaScript Type | PostgreSQL Type | Notes |
|----------------|-----------------|-------|
| `string` | `TEXT` | Variable-length text |
| `number` | `DOUBLE PRECISION` | Floating-point number |
| `boolean` | `BOOLEAN` | True/false |
| `object` | `JSONB` | Nested objects stored as JSON |
| `array` | `JSONB` | Arrays stored as JSON |
| `null` | Based on nullable flag | `NOT NULL` or nullable |

**Example DDL Generation:**

**Input JSON:**
```json
[
  { "id": 1, "name": "John", "age": 30, "active": true, "tags": ["tag1", "tag2"] }
]
```

**Field Analysis:**
- `id`: types: ['number'], nested: false
- `name`: types: ['string'], nested: false
- `age`: types: ['number'], nested: false
- `active`: types: ['boolean'], nested: false
- `tags`: types: ['array'], nested: true

**Generated DDL:**
```sql
CREATE TABLE IF NOT EXISTS dataset_example_53ee7c71 (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  id DOUBLE PRECISION NOT NULL,
  name TEXT NOT NULL,
  age DOUBLE PRECISION NOT NULL,
  active BOOLEAN NOT NULL,
  tags JSONB NOT NULL
);
```

---

### Step 3: JSON Schema Generation

**Location:** `backend/src/services/schema-generator.service.js:74-96`

#### Process:

```javascript
generateJsonSchema(fields) {
  const properties = {};
  const required = [];

  for (const [fieldName, fieldInfo] of Object.entries(fields)) {
    const property = this.mapToJsonSchemaType(fieldInfo);
    properties[fieldName] = property;

    // Add to required if not nullable
    if (!fieldInfo.nullable) {
      required.push(fieldName);
    }
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };
}
```

#### JSON Schema Type Mapping

**Location:** `backend/src/services/schema-generator.service.js:103-136`

```javascript
mapToJsonSchemaType(fieldInfo) {
  const types = fieldInfo.types || [];

  // Handle nested objects (recursive)
  if (fieldInfo.nested && fieldInfo.nestedFields) {
    if (types.includes('object')) {
      return {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(fieldInfo.nestedFields).map(([key, value]) => [
            key,
            this.mapToJsonSchemaType(value),  // Recursive call
          ])
        ),
      };
    }
    if (types.includes('array')) {
      return {
        type: 'array',
        items: { type: 'object' },
      };
    }
  }

  // Handle multiple types
  if (types.length > 1) {
    const schemaTypes = types.map(t => this.mapSingleTypeToJsonSchema(t));
    return { type: schemaTypes };
  }

  // Single type
  const type = types[0];
  return { type: this.mapSingleTypeToJsonSchema(type) };
}
```

**Example JSON Schema:**

**Input JSON:**
```json
[
  { "id": 1, "name": "John", "age": 30, "active": true }
]
```

**Generated JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "number" },
    "name": { "type": "string" },
    "age": { "type": "number" },
    "active": { "type": "boolean" }
  },
  "required": ["id", "name", "age", "active"]
}
```

---

### Step 4: Fields Array Generation

**Location:** `backend/src/jsonPipeline/json.orchestrator.js:135-146`

```javascript
convertFieldsToSchema(fields) {
  if (!fields) return [];
  
  return Object.entries(fields).map(([name, info]) => ({
    name,
    type: this.inferType(info.types || []),
    nullable: info.nullable || false,
    nested: info.nested || false,
    array: (info.types || []).includes('array'),
    enum: null,  // Could be enhanced to detect enums
  }));
}
```

**Type Inference:**

**Location:** `backend/src/jsonPipeline/json.orchestrator.js:151-158`

```javascript
inferType(types) {
  if (types.includes('number')) return 'number';
  if (types.includes('boolean')) return 'boolean';
  if (types.includes('string')) return 'string';
  if (types.includes('array')) return 'array';
  if (types.includes('object')) return 'object';
  return 'string';  // Default
}
```

**Example Fields Array:**

```json
[
  {
    "name": "id",
    "type": "number",
    "nullable": false,
    "nested": false,
    "array": false,
    "enum": null
  },
  {
    "name": "tags",
    "type": "array",
    "nullable": false,
    "nested": true,
    "array": true,
    "enum": null
  }
]
```

---

## Storage Mechanisms

### SQL Storage (PostgreSQL)

**Location:** `backend/src/services/catalog.service.js:396-427`

#### Process:

```javascript
async storeInPostgres(tableName, ddl, data) {
  // Step 1: Create table using DDL
  await db.raw(ddl);
  
  // Step 2: Normalize data (handle single object or array)
  const dataArray = Array.isArray(data) ? data : [data];
  
  // Step 3: Flatten nested structures
  const flattenedData = dataArray.map(record =>
    jsonPipeline.flattenObject(record)
  );
  
  // Step 4: Insert into PostgreSQL table
  if (flattenedData.length > 0) {
    await db(tableName).insert(flattenedData);
  }
  
  return flattenedData.length;
}
```

#### Data Flattening

**Location:** `backend/src/services/json-pipeline.service.js:292-312`

```javascript
flattenObject(obj, prefix = '') {
  const flattened = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    
    if (value === null || value === undefined) {
      flattened[newKey] = value;
    } else if (Array.isArray(value)) {
      // Arrays stored as JSON strings
      flattened[newKey] = JSON.stringify(value);
    } else if (typeof value === 'object') {
      // Recursively flatten nested objects
      Object.assign(flattened, this.flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }
  
  return flattened;
}
```

**Flattening Examples:**

**Input:**
```json
{
  "id": 1,
  "name": { "first": "John", "last": "Doe" },
  "tags": ["tag1", "tag2"]
}
```

**Output:**
```json
{
  "id": 1,
  "name_first": "John",
  "name_last": "Doe",
  "tags": "[\"tag1\",\"tag2\"]"
}
```

**Storage Location:**
- **Table:** `dataset_<name>_<shortId>` (e.g., `dataset_sql3_53ee7c71`)
- **Database:** `smart_storage` (PostgreSQL)
- **Catalog:** `dataset_catalog` table (PostgreSQL)

---

### NoSQL Storage (MongoDB)

**Location:** `backend/src/services/catalog.service.js:435-470`

#### Process:

```javascript
async storeInMongoDB(datasetId, data) {
  // Step 1: Get MongoDB connection
  const collectionName = `dataset_${datasetId}`;
  const db = mongoose.connection.db;
  const collection = db.collection(collectionName);
  
  // Step 2: Normalize data (handle single object or array)
  let documents;
  if (Array.isArray(data)) {
    documents = data.map(record => ({
      ...record,
      _datasetId: datasetId,
      _importedAt: new Date(),
    }));
  } else {
    documents = [{
      ...data,
      _datasetId: datasetId,
      _importedAt: new Date(),
    }];
  }
  
  // Step 3: Insert into MongoDB collection (preserves structure)
  const result = await collection.insertMany(documents);
  
  return result.insertedCount;
}
```

**Key Differences from SQL:**
- ✅ **No flattening** - Nested structures preserved
- ✅ **No schema enforcement** - Flexible document structure
- ✅ **Metadata added** - `_datasetId` and `_importedAt` fields

**Storage Location:**
- **Collection:** `dataset_<fullUUID>` (e.g., `dataset_53ee7c71-36fe-4599-bd63-7da7bdbddb8b`)
- **Database:** `smart_storage` (MongoDB)
- **Catalog:** `dataset_catalog` collection (MongoDB)

---

## File Processing Pipelines

### JSON Pipeline Flow

```
JSON File Uploaded
    │
    ▼
┌─────────────────────────────────────┐
│ 1. JSON Parsing & Validation        │
│    - Read file content               │
│    - Validate JSON syntax             │
│    - Parse JSON.parse()               │
│    - Handle NDJSON (line-delimited)   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Structure Analysis                │
│    - Detect: Array vs Object         │
│    - Extract fields from sample      │
│    - Determine nested structures     │
│    - Build field type map            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Schema Generation                 │
│    - Generate table name             │
│    - Create SQL DDL                  │
│    - Create JSON Schema              │
│    - Build fields array              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Backend Decision                  │
│    - Check for nested fields         │
│    - Determine: SQL or NoSQL         │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
┌─────────────┐ ┌─────────────┐
│   SQL       │ │   NoSQL     │
│ PostgreSQL  │ │  MongoDB    │
│             │ │             │
│ - Flatten   │ │ - Preserve  │
│ - Create    │ │ - Insert    │
│   table     │ │   documents │
│ - Insert    │ │             │
│   rows      │ │             │
└──────┬──────┘ └──────┬──────┘
       │               │
       └───────┬───────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Catalog Entry                     │
│    - Store in dataset_catalog        │
│    - Save schema metadata            │
│    - Record storage location         │
└─────────────────────────────────────┘
```

### Media Pipeline Flow

```
Media File Uploaded
    │
    ▼
┌─────────────────────────────────────┐
│ 1. File Type Detection               │
│    - Detect MIME type                │
│    - Identify: image/video/audio     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Metadata Extraction               │
│    - Extract dimensions (width/height)│
│    - Extract EXIF data (images)      │
│    - Extract duration (video/audio) │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Cloudinary Upload                 │
│    - Upload to cloud storage         │
│    - Get public URL                  │
│    - Get Cloudinary metadata         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Database Storage                  │
│    - Create media_<type> table       │
│    - Store metadata in PostgreSQL    │
│    - Link to Cloudinary URL          │
└─────────────────────────────────────┘
```

---

## Code References

### Key Files

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **JSON Orchestrator** | `backend/src/jsonPipeline/json.orchestrator.js` | Main JSON processing coordinator |
| **JSON Pipeline Service** | `backend/src/services/json-pipeline.service.js` | JSON parsing, validation, analysis |
| **Schema Generator** | `backend/src/services/schema-generator.service.js` | SQL DDL and JSON Schema generation |
| **Catalog Service** | `backend/src/services/catalog.service.js` | Dataset cataloging and storage |
| **Detection Service** | `backend/src/detection/detection.service.js` | File type detection |
| **Upload Route** | `backend/src/ingest/ingest.routes.js` | File upload endpoint |
| **Staging Model** | `backend/src/ingest/staging.model.js` | Staging file management |

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `processStagingFile()` | `json.orchestrator.js:11` | Main JSON processing entry point |
| `determineBackend()` | `json.orchestrator.js:163` | SQL vs NoSQL decision |
| `analyzeJsonStructure()` | `json-pipeline.service.js:195` | JSON structure analysis |
| `extractFields()` | `json-pipeline.service.js:226` | Field extraction and type detection |
| `generatePostgresDDL()` | `schema-generator.service.js:15` | SQL DDL generation |
| `generateJsonSchema()` | `schema-generator.service.js:74` | JSON Schema generation |
| `storeInPostgres()` | `catalog.service.js:396` | PostgreSQL data storage |
| `storeInMongoDB()` | `catalog.service.js:435` | MongoDB data storage |
| `flattenObject()` | `json-pipeline.service.js:292` | Data flattening for SQL |

---

## Summary

### Classification Criteria Summary

| Criteria | SQL (PostgreSQL) | NoSQL (MongoDB) |
|----------|------------------|-----------------|
| **Nested Fields** | ❌ None | ✅ Has nested objects/arrays |
| **Data Structure** | Flat/tabular | Nested/complex |
| **Schema** | Fixed (DDL executed) | Flexible (DDL not executed) |
| **Data Format** | Flattened | Preserved structure |
| **Storage** | Tables | Collections |
| **Query Language** | SQL | MongoDB queries |

### Schema Generation Summary

| Schema Type | Generated For | Purpose | Executed |
|-------------|--------------|---------|----------|
| **SQL DDL** | All datasets | Table definition | ✅ Only for SQL datasets |
| **JSON Schema** | All datasets | Data validation | ❌ Reference only |
| **Fields Array** | All datasets | Simplified schema | ❌ Reference only |

### Storage Summary

| Storage Type | Database | Location | Format |
|--------------|----------|----------|--------|
| **SQL Data** | PostgreSQL | `dataset_<name>_<id>` table | Flattened rows |
| **NoSQL Data** | MongoDB | `dataset_<uuid>` collection | Preserved documents |
| **SQL Catalog** | PostgreSQL | `dataset_catalog` table | Metadata |
| **NoSQL Catalog** | MongoDB | `dataset_catalog` collection | Metadata |
| **Staging Files** | PostgreSQL | `staging_files` table | Temporary |

---

## Examples

### Example 1: SQL Dataset

**Input JSON:**
```json
[
  { "id": 1, "name": "John", "age": 30 },
  { "id": 2, "name": "Jane", "age": 25 }
]
```

**Classification:**
- Fields: `id`, `name`, `age` (all primitive)
- Nested: `false` for all fields
- **Decision:** SQL

**Storage:**
- Table: `dataset_users_53ee7c71`
- Data: Flattened rows in PostgreSQL
- Catalog: PostgreSQL `dataset_catalog` table

---

### Example 2: NoSQL Dataset

**Input JSON:**
```json
{
  "users": [
    { "id": 1, "name": { "first": "John", "last": "Doe" } }
  ],
  "products": [
    { "id": 1, "tags": ["tag1", "tag2"] }
  ]
}
```

**Classification:**
- Fields: `users` (array), `products` (array)
- Nested: `true` for all fields
- **Decision:** NoSQL

**Storage:**
- Collection: `dataset_53ee7c71-36fe-4599-bd63-7da7bdbddb8b`
- Data: Preserved structure in MongoDB
- Catalog: MongoDB `dataset_catalog` collection

---

This documentation provides a complete understanding of the data flow, classification criteria, and schema generation process in the EZ_store application.

