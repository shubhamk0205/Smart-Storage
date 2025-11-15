# 🗄️ Database Configuration and Data Ingestion Flow

## 📋 Database Configuration

### 1. PostgreSQL Configuration

#### **Location:** `backend/src/config/knex.config.js`

**Connection Setup:**
```javascript
// Priority order:
1. DATABASE_URL (if set) → Parsed and configured
2. Individual env vars (PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD)
3. Defaults (localhost:5432, database: smart_storage)
```

**Key Configurations:**
- **Client:** `pg` (PostgreSQL client)
- **Connection Pool:** 
  - Development: min 2, max 10 connections
  - Production: min 2, max 20 connections
- **SSL:** 
  - Supabase: `{ rejectUnauthorized: false }` (required)
  - Docker/Local: `false` (no SSL needed)
- **IPv6:** Forced for Supabase connections (`family: 6`)

**Connection String Parsing:**
```javascript
// For Supabase:
{
  host: dbUrl.hostname,
  port: 5432,
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: dbUrl.password,
  ssl: { rejectUnauthorized: false },
  family: 6  // Force IPv6
}

// For Docker/Local:
{
  host: 'localhost',
  port: 5432,
  database: 'smart_storage',
  user: 'postgres',
  password: 'postgres',
  ssl: false
}
```

#### **Docker Configuration:** `docker-compose.yml`
```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: smart_storage
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  ports:
    - "5432:5432"
```

---

### 2. MongoDB Configuration

#### **Location:** `backend/src/config/mongoose.js`

**Connection Setup:**
```javascript
// Connection URI from environment:
MONGO_URI=mongodb://admin:admin@localhost:27017/smart_storage?authSource=admin
```

**Key Configurations:**
- **Connection Options:**
  - `maxPoolSize: 10` - Maximum connection pool size
  - `serverSelectionTimeoutMS: 5000` - Timeout for server selection
  - `socketTimeoutMS: 45000` - Socket timeout
- **Database Name:** `smart_storage`
- **Authentication:** `admin/admin` (root user)

**Connection Events:**
- `connected` - Logs connection details
- `error` - Logs connection errors
- `disconnected` - Logs disconnection
- `reconnected` - Logs reconnection

#### **Docker Configuration:** `docker-compose.yml`
```yaml
mongodb:
  image: mongo:7
  environment:
    MONGO_INITDB_ROOT_USERNAME: admin
    MONGO_INITDB_ROOT_PASSWORD: admin
    MONGO_INITDB_DATABASE: smart_storage
  ports:
    - "27017:27017"
```

---

## 🔄 SQL Data Ingestion Flow

### **Entry Point:** `backend/src/jsonPipeline/json.orchestrator.js`

### **Step-by-Step Process:**

#### **1. File Processing** (`processStagingFile`)
```javascript
// Location: json.orchestrator.js:11
const processingResult = await jsonPipelineService.processJson(
  stagingFile.filePath, 
  ext
);
```
- Parses JSON file
- Validates JSON syntax
- Analyzes structure and fields

#### **2. Backend Decision** (`determineBackend`)
```javascript
// Location: json.orchestrator.js:163
determineBackend(analysis) {
  if (analysis.fields) {
    const hasNested = Object.values(analysis.fields).some(f => f.nested);
    return hasNested ? 'nosql' : 'sql';  // No nested = SQL
  }
  return 'sql';
}
```
**Decision Logic:**
- ✅ **SQL:** If data has NO nested objects/arrays in fields
- ❌ **NoSQL:** If data has nested structures

#### **3. Schema Generation**
```javascript
// Location: json.orchestrator.js:22-27
const datasetId = uuidv4();
const tableName = schemaGenerator.generateTableName(finalDatasetName, datasetId);
const fieldsObj = processingResult.analysis.fields || {};
const fields = this.convertFieldsToSchema(fieldsObj);
const ddl = schemaGenerator.generatePostgresDDL(tableName, fieldsObj);
const jsonSchema = schemaGenerator.generateJsonSchema(fieldsObj);
```

**Generated Artifacts:**
- **Table Name:** `dataset_<name>_<shortId>` (e.g., `dataset_sql3_12090a9b`)
- **SQL DDL:** CREATE TABLE statement with columns
- **JSON Schema:** Schema definition for validation
- **Fields:** Field definitions with types

#### **4. Data Storage** (`storeInPostgres`)
```javascript
// Location: catalog.service.js:400+
async storeInPostgres(tableName, ddl, data) {
  // Step 1: Execute DDL to create table
  await db.raw(ddl);
  
  // Step 2: Handle single object or array
  const dataArray = Array.isArray(data) ? data : [data];
  
  // Step 3: Flatten nested structures
  const flattened = dataArray.map(item => this.flattenObject(item));
  
  // Step 4: Insert into PostgreSQL table
  await db(tableName).insert(flattened);
  
  return flattened.length;
}
```

**Storage Configuration:**
- **Table Creation:** Uses Knex `db.raw(ddl)` to execute CREATE TABLE
- **Data Flattening:** Converts nested objects to flat structure
- **Bulk Insert:** Uses Knex `db(tableName).insert()` for batch insertion
- **Type Mapping:**
  - `string` → `TEXT`
  - `number` → `DOUBLE PRECISION`
  - `boolean` → `BOOLEAN`
  - `object/array` → `JSONB` (stored as JSON)

#### **5. Catalog Entry Creation** (`createDataset`)
```javascript
// Location: catalog.service.js:52
async createDataset(datasetInfo) {
  const storage = datasetInfo.storage || 'mongodb';
  
  if (storage === 'postgres') {
    // Store in PostgreSQL dataset_catalog table
    await ensurePostgresCatalogTable();
    
    const [record] = await db('dataset_catalog')
      .insert({
        dataset_id: datasetInfo.datasetId,
        original_name: datasetInfo.originalName,
        file_path: datasetInfo.filePath,
        storage: 'postgres',
        dataset_schema: datasetInfo.datasetSchema,  // JSONB column
        // ... other fields
      })
      .returning('*');
  }
}
```

**Catalog Storage:**
- **Table:** `dataset_catalog` (PostgreSQL)
- **Schema Field:** `dataset_schema` (JSONB) contains:
  - `jsonSchema` - JSON Schema definition
  - `sqlDDL` - CREATE TABLE statement
  - `tableName` - Generated table name
  - `fields` - Field definitions

---

## 🔄 NoSQL Data Ingestion Flow

### **Entry Point:** `backend/src/jsonPipeline/json.orchestrator.js`

### **Step-by-Step Process:**

#### **1. File Processing** (Same as SQL)
```javascript
const processingResult = await jsonPipelineService.processJson(
  stagingFile.filePath, 
  ext
);
```

#### **2. Backend Decision** (`determineBackend`)
```javascript
// Location: json.orchestrator.js:163
determineBackend(analysis) {
  if (analysis.fields) {
    const hasNested = Object.values(analysis.fields).some(f => f.nested);
    return hasNested ? 'nosql' : 'sql';  // Has nested = NoSQL
  }
  return 'sql';
}
```
**Decision Logic:**
- ✅ **NoSQL:** If data has nested objects/arrays in fields
- ❌ **SQL:** If data is flat/tabular

#### **3. Schema Generation** (Same as SQL)
- Still generates SQL DDL and JSON Schema for reference
- But data will be stored in MongoDB

#### **4. Data Storage** (`storeInMongoDB`)
```javascript
// Location: catalog.service.js:450+
async storeInMongoDB(datasetId, data) {
  // Step 1: Get MongoDB connection
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB not connected');
  }
  
  // Step 2: Handle single object or array
  const dataArray = Array.isArray(data) ? data : [data];
  
  // Step 3: Add metadata to each document
  const documents = dataArray.map(item => ({
    ...item,
    _datasetId: datasetId,
    _importedAt: new Date(),
  }));
  
  // Step 4: Insert into MongoDB collection
  const collection = db.collection(`dataset_${datasetId}`);
  await collection.insertMany(documents);
  
  return documents.length;
}
```

**Storage Configuration:**
- **Collection Name:** `dataset_<uuid>` (e.g., `dataset_53ee7c71-36fe-4599-bd63-7da7bdbddb8b`)
- **Document Structure:** Preserves complete JSON structure (nested objects/arrays intact)
- **Metadata Added:**
  - `_datasetId` - Links document to dataset
  - `_importedAt` - Import timestamp
- **Bulk Insert:** Uses `insertMany()` for batch insertion
- **No Flattening:** Documents stored as-is (preserves nested structure)

#### **5. Catalog Entry Creation** (`createDataset`)
```javascript
// Location: catalog.service.js:52
async createDataset(datasetInfo) {
  const storage = datasetInfo.storage || 'mongodb';
  
  if (storage === 'mongodb') {
    // Store in MongoDB dataset_catalog collection
    const DatasetModel = await Dataset();
    const dataset = new DatasetModel(datasetInfo);
    await dataset.save();
  }
}
```

**Catalog Storage:**
- **Collection:** `dataset_catalog` (MongoDB)
- **Schema Field:** `datasetSchema` contains:
  - `jsonSchema` - JSON Schema definition
  - `sqlDDL` - CREATE TABLE statement (for reference)
  - `tableName` - Generated table name (for reference)
  - `fields` - Field definitions

---

## 📊 Complete Ingestion Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FILE UPLOAD                              │
│              (POST /api/ingest/upload)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              STAGING (PostgreSQL)                            │
│         Table: staging_files                                │
│         - File metadata                                     │
│         - Status: pending → detected                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            JSON PROCESSING                                   │
│         jsonPipelineService.processJson()                    │
│         - Parse JSON                                         │
│         - Validate syntax                                    │
│         - Analyze structure                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         BACKEND DECISION                                     │
│         determineBackend(analysis)                           │
│                                                              │
│         Has nested fields?                                  │
│         ├─ YES → NoSQL (MongoDB)                            │
│         └─ NO  → SQL (PostgreSQL)                           │
└──────┬───────────────────────────────────────────┬──────────┘
       │                                           │
       ▼                                           ▼
┌──────────────────────┐              ┌──────────────────────┐
│   SQL PATH           │              │   NoSQL PATH         │
│                      │              │                      │
│ 1. Generate DDL      │              │ 1. Generate DDL      │
│ 2. Create Table      │              │    (for reference)    │
│ 3. Flatten Data      │              │ 2. Preserve Structure│
│ 4. Insert to PG      │              │ 3. Insert to MongoDB │
│    (table)           │              │    (collection)      │
│                      │              │                      │
│ Table:               │              │ Collection:          │
│ dataset_<name>_<id>  │              │ dataset_<uuid>       │
└──────────┬───────────┘              └──────────┬───────────┘
           │                                     │
           └──────────────┬─────────────────────┘
                          │
                          ▼
           ┌──────────────────────────────┐
           │   CATALOG ENTRY CREATION      │
           │                               │
           │  SQL → PostgreSQL             │
           │    dataset_catalog table      │
           │                               │
           │  NoSQL → MongoDB              │
           │    dataset_catalog collection │
           └──────────────────────────────┘
```

---

## 🔧 Key Configuration Methods

### **SQL Storage Method:** `catalog.service.js::storeInPostgres()`

**Configuration Details:**
```javascript
async storeInPostgres(tableName, ddl, data) {
  // 1. Execute DDL to create table
  await db.raw(ddl);
  
  // 2. Normalize data (handle single object or array)
  const dataArray = Array.isArray(data) ? data : [data];
  
  // 3. Flatten nested structures for SQL storage
  const flattened = dataArray.map(item => this.flattenObject(item));
  
  // 4. Insert using Knex query builder
  if (flattened.length > 0) {
    await db(tableName).insert(flattened);
  }
  
  return flattened.length;
}
```

**Key Points:**
- Uses **Knex.js** query builder (`db.raw()`, `db(tableName).insert()`)
- **Flattens** nested objects using `flattenObject()` method:
  - `{user: {name: "John"}}` → `{user_name: "John"}`
  - Arrays stored as JSON strings: `[1,2,3]` → `"[1,2,3]"`
  - Nested objects recursively flattened: `{a: {b: {c: 1}}}` → `{a_b_c: 1}`
- **Type mapping** happens in DDL generation (string→TEXT, number→DOUBLE PRECISION)
- **Bulk insert** for performance

### **NoSQL Storage Method:** `catalog.service.js::storeInMongoDB()`

**Configuration Details:**
```javascript
async storeInMongoDB(datasetId, data) {
  // 1. Get MongoDB database connection
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB not connected');
  }
  
  // 2. Normalize data (handle single object or array)
  const dataArray = Array.isArray(data) ? data : [data];
  
  // 3. Add metadata to each document
  const documents = dataArray.map(item => ({
    ...item,
    _datasetId: datasetId,
    _importedAt: new Date(),
  }));
  
  // 4. Insert using native MongoDB driver
  const collection = db.collection(`dataset_${datasetId}`);
  await collection.insertMany(documents);
  
  return documents.length;
}
```

**Key Points:**
- Uses **MongoDB native driver** (`mongoose.connection.db.collection()`)
- **Preserves** nested structure (no flattening)
- **Adds metadata** (`_datasetId`, `_importedAt`) to each document
- **Bulk insert** using `insertMany()`

---

## 📝 Summary

### **Database Names:**
- **PostgreSQL:** `smart_storage`
- **MongoDB:** `smart_storage`

### **SQL Ingestion Configuration:**
1. **Connection:** Knex.js with PostgreSQL client (`pg`)
2. **Storage Method:** `storeInPostgres()` in `catalog.service.js`
3. **Data Location:** `dataset_<name>_<id>` tables in PostgreSQL
4. **Catalog Location:** `dataset_catalog` table in PostgreSQL
5. **Data Format:** Flattened (nested objects converted to flat columns)
6. **Type Mapping:** Automatic (string→TEXT, number→DOUBLE PRECISION, etc.)

### **NoSQL Ingestion Configuration:**
1. **Connection:** Mongoose with MongoDB native driver
2. **Storage Method:** `storeInMongoDB()` in `catalog.service.js`
3. **Data Location:** `dataset_<uuid>` collections in MongoDB
4. **Catalog Location:** `dataset_catalog` collection in MongoDB
5. **Data Format:** Preserved (nested structure intact)
6. **Metadata:** Auto-added (`_datasetId`, `_importedAt`)

### **Decision Logic:**
- **SQL:** Chosen when data has NO nested fields
- **NoSQL:** Chosen when data HAS nested fields

Both databases work together to provide optimal storage for different data structures! 🎯

