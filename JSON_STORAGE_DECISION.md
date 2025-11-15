# 📊 JSON Storage Decision - Where Your Data Goes

## Your JSON Structure

Your JSON file has this structure:
```json
{
  "customers": [...],      // Array of objects
  "addresses": [...],      // Array of objects
  "products": [...],       // Array of objects
  "orders": [...],         // Array of objects
  "order_items": [...],    // Array of objects
  "payments": [...]        // Array of objects
}
```

**Type:** Single object with multiple array properties (NOT an array of objects)

## Algorithm Analysis

### Step 1: Structure Detection
- **Input:** Your JSON (single object with arrays)
- **Detection:** `analyzeJsonStructure()` detects it as an **object** (not array)
- **Fields Extracted:**
  - `customers` → type: `array`, nested: `true`
  - `addresses` → type: `array`, nested: `true`
  - `products` → type: `array`, nested: `true`
  - `orders` → type: `array`, nested: `true`
  - `order_items` → type: `array`, nested: `true`
  - `payments` → type: `array`, nested: `true`

### Step 2: Backend Decision
```javascript
determineBackend(analysis) {
  if (analysis.fields) {
    const hasNested = Object.values(analysis.fields).some(f => f.nested);
    return hasNested ? 'nosql' : 'sql';
  }
  return 'sql';
}
```

**Result:** 
- ✅ All fields are arrays → `nested: true`
- ✅ `hasNested = true`
- ✅ **Backend: `nosql` (MongoDB)**

### Step 3: Storage Location

**Storage Backend:** MongoDB (NoSQL)

**Why MongoDB?**
- Your JSON is a **single object** (not an array of objects)
- All top-level properties are **arrays** (nested structures)
- MongoDB is better suited for:
  - Nested/complex data structures
  - Single documents with multiple collections
  - Flexible schema

## Where Your Data Will Be Stored

### 1. **Dataset Catalog** (MongoDB)
**Collection:** `datasets`
**Document Contains:**
```json
{
  "datasetId": "<uuid>",
  "originalName": "your-file.json",
  "storage": "mongodb",
  "datasetSchema": {
    "jsonSchema": { ... },
    "sqlDDL": "CREATE TABLE ...",
    "tableName": "dataset_<name>_<id>",
    "fields": [
      { "name": "customers", "type": "array", "nested": true },
      { "name": "addresses", "type": "array", "nested": true },
      { "name": "products", "type": "array", "nested": true },
      { "name": "orders", "type": "array", "nested": true },
      { "name": "order_items", "type": "array", "nested": true },
      { "name": "payments", "type": "array", "nested": true }
    ]
  },
  "recordCount": 1,
  "createdAt": "..."
}
```

### 2. **Actual Data** (MongoDB)
**Collection:** `dataset_<datasetId>`
**Document Structure:**
```json
{
  "_id": ObjectId("..."),
  "_datasetId": "<uuid>",
  "_importedAt": "2025-11-15T...",
  "customers": [
    { "id": 1, "first_name": "Aarav", ... },
    { "id": 2, "first_name": "Zoya", ... },
    { "id": 3, "first_name": "Rohan", ... }
  ],
  "addresses": [
    { "id": 1001, "customer_id": 1, ... },
    { "id": 1002, "customer_id": 2, ... },
    { "id": 1003, "customer_id": 3, ... }
  ],
  "products": [
    { "id": 101, "sku": "TSHIRT-NEON-XS", ... },
    ...
  ],
  "orders": [
    { "id": 5001, "customer_id": 1, ... },
    ...
  ],
  "order_items": [
    { "id": 7001, "order_id": 5001, ... },
    ...
  ],
  "payments": [
    { "id": 9001, "order_id": 5001, ... },
    ...
  ]
}
```

**Note:** The entire JSON object is stored as **ONE document** in MongoDB.

## Complete Flow

```
1. Upload JSON File
   ↓
2. Parse & Analyze
   - Detects: Object with 6 array properties
   - All arrays marked as nested: true
   ↓
3. Backend Decision
   - hasNested = true
   - Decision: MongoDB (NoSQL)
   ↓
4. Generate Schema
   - JSON Schema: Object with 6 array properties
   - SQL DDL: Generated (but won't be used)
   - Fields: 6 fields, all nested arrays
   ↓
5. Store Data
   - Location: MongoDB collection `dataset_<uuid>`
   - Format: Single document with all data
   - Metadata: _datasetId, _importedAt added
   ↓
6. Store Schema
   - Location: MongoDB collection `datasets`
   - Contains: Full schema, metadata, storage info
```

## Why Not PostgreSQL?

Your JSON would NOT go to PostgreSQL because:

1. ❌ **Not an array of objects** - PostgreSQL expects `[{...}, {...}]` format
2. ✅ **Has nested structures** - All top-level properties are arrays
3. ✅ **Complex structure** - Single object with multiple related collections
4. ✅ **MongoDB is better** - Designed for document storage with nested data

## If You Wanted PostgreSQL Instead

To store in PostgreSQL, your JSON would need to be:
```json
[
  { "id": 1, "name": "Customer 1", ... },
  { "id": 2, "name": "Customer 2", ... }
]
```

**OR** each array would need to be stored separately as different tables.

## Summary

✅ **Storage Backend:** MongoDB (NoSQL)
✅ **Collection Name:** `dataset_<uuid>` (e.g., `dataset_53ee7c71-36fe-4599-bd63-7da7bdbddb8b`)
✅ **Document Count:** 1 document (entire JSON as one document)
✅ **Schema Location:** MongoDB `datasets` collection
✅ **Reason:** Nested array structures detected → NoSQL backend selected

