# 📄 Detailed Flow: Uploading Your JSON File

## 📋 Your JSON File Structure

Your file contains:
```json
{
  "users": [3 user objects],
  "products": [3 product objects],
  "orders": [3 order objects]
}
```

**Key Characteristics:**
- Top-level is an **object** (not an array)
- Contains 3 keys: `users`, `products`, `orders`
- Each key contains an **array** of objects
- Each object has **nested structures** (e.g., `name: {first, last}`, `address: {...}`, `location: {...}`)

---

## 🔄 Complete Flow (Step-by-Step)

### **Step 1: File Upload** 📤
```
User uploads: data.json
    ↓
File saved to: backend/uploads/<uuid>.json
    ↓
Staging record created in PostgreSQL (staging_files table)
    - id: <uuid>
    - originalFilename: "data.json"
    - sizeBytes: <file size>
    - sha256: <hash>
    - mimeType: "application/json"
    - status: "pending"
```

### **Step 2: File Type Detection** 🔍
```
System detects: .json extension
    ↓
MIME type: application/json
    ↓
Category: json
    ↓
Routes to: JSON Pipeline
```

### **Step 3: JSON Processing** 📊
```
jsonPipelineService.processJson(filePath, 'json')
    ↓
Reads file content
    ↓
Parses JSON: {
  users: [...],
  products: [...],
  orders: [...]
}
    ↓
Calls: analyzeJsonStructure(data)
```

### **Step 4: Structure Analysis** 🔬
```
analyzeJsonStructure() detects:
    - Type: "object" (not array)
    - Top-level fields: ["users", "products", "orders"]
    ↓
extractFields() analyzes each field:
    
    Field: "users"
      - Type: array
      - Nested: true ✅
      - Contains: array of user objects
    
    Field: "products"
      - Type: array
      - Nested: true ✅
      - Contains: array of product objects
    
    Field: "orders"
      - Type: array
      - Nested: true ✅
      - Contains: array of order objects
```

**Analysis Result:**
```javascript
{
  type: 'object',
  fields: {
    users: {
      types: ['array'],
      nested: true,
      nullable: false
    },
    products: {
      types: ['array'],
      nested: true,
      nullable: false
    },
    orders: {
      types: ['array'],
      nested: true,
      nullable: false
    }
  }
}
```

### **Step 5: Backend Decision** 🧠
```
determineBackend(analysis)
    ↓
Checks: Does any field have nested: true?
    - users: nested = true ✅
    - products: nested = true ✅
    - orders: nested = true ✅
    ↓
Result: hasNested = true
    ↓
Decision: 'nosql' (MongoDB)
```

**Why MongoDB?**
- The data structure has nested arrays at the top level
- Each array contains complex objects with nested structures
- MongoDB is better suited for this hierarchical data

### **Step 6: Schema Generation** 📐
```
Even though using MongoDB, schemas are still generated:

1. JSON Schema:
   {
     type: "object",
     properties: {
       users: { type: "array", items: {...} },
       products: { type: "array", items: {...} },
       orders: { type: "array", items: {...} }
     }
   }

2. SQL DDL (generated but not used):
   CREATE TABLE dataset_data_<uuid> (
     users JSONB,
     products JSONB,
     orders JSONB
   )
```

### **Step 7: Data Storage** 💾
```
Backend: 'nosql' (MongoDB)
    ↓
isArrayOfObjects(data)?
    - data is an object, not an array
    - Returns: false
    ↓
Stores in MongoDB:
    Collection: dataset_<datasetId>
    Document: {
      users: [...],
      products: [...],
      orders: [...],
      _datasetId: <uuid>,
      _importedAt: <timestamp>
    }
    ↓
Record count: 1 (single document)
```

### **Step 8: Catalog Entry** 📚
```
Creates dataset catalog entry in MongoDB:
    {
      datasetId: <uuid>,
      originalName: "data.json",
      storage: "mongodb",
      recordCount: 1,
      schema: {
        jsonSchema: {...},
        sqlDDL: "...",
        tableName: "dataset_data_<uuid>",
        fields: [...]
      },
      metadata: {
        type: "object",
        fields: {...}
      }
    }
```

---

## 🗄️ Database Storage Details

### **MongoDB Storage**

**Collection Name:** `dataset_<datasetId>`

**Document Structure:**
```javascript
{
  users: [
    {
      _id: "64f9c2a1b7e5a3c9d4f1a201",
      name: { first: "Aarav", last: "Sharma" },
      email: "aarav.sharma@example.com",
      // ... all user fields preserved
    },
    // ... 2 more users
  ],
  products: [
    {
      _id: "64f9c2a1b7e5a3c9d4f1a301",
      sku: "TSHIRT-NEON-XS",
      // ... all product fields preserved
    },
    // ... 2 more products
  ],
  orders: [
    {
      _id: "64f9c2a1b7e5a3c9d4f1a401",
      userId: "64f9c2a1b7e5a3c9d4f1a201",
      items: [...],
      // ... all order fields preserved
    },
    // ... 2 more orders
  ],
  _datasetId: "<uuid>",
  _importedAt: ISODate("2025-11-15T...")
}
```

**Key Points:**
- ✅ Entire structure preserved as-is
- ✅ All nested objects maintained
- ✅ Arrays stored as arrays (not flattened)
- ✅ Single document contains all data

### **PostgreSQL Storage**

**Not Used** - Because:
- Data has nested structures
- Top-level is an object, not an array of objects
- MongoDB is better suited for this structure

---

## 📊 What Gets Stored Where

| Component | Location | Details |
|-----------|----------|---------|
| **Raw Data** | MongoDB Collection: `dataset_<uuid>` | Single document with users, products, orders |
| **Staging Record** | PostgreSQL: `staging_files` table | File metadata, SHA256, status |
| **Catalog Entry** | MongoDB: `datasets` collection | Dataset info, schema, metadata |
| **Schema Definitions** | MongoDB: Catalog entry | JSON Schema and SQL DDL (for reference) |

---

## 🔍 Querying Your Data

### **From MongoDB:**
```javascript
// Get the entire dataset
db.getCollection('dataset_<uuid>').findOne()

// Get all users
db.getCollection('dataset_<uuid>').findOne({}, {users: 1})

// Get all products
db.getCollection('dataset_<uuid>').findOne({}, {products: 1})

// Get all orders
db.getCollection('dataset_<uuid>').findOne({}, {orders: 1})
```

### **From API (Retrieval Endpoint):**
```javascript
POST /api/retrieve
{
  "dataset": "<datasetName>",
  "entity": "dataset_<uuid>",
  "filter": {},
  "limit": 10
}
```

---

## 🎯 Summary

### **Flow Summary:**
1. ✅ File uploaded → Staging (PostgreSQL)
2. ✅ JSON detected → JSON Pipeline
3. ✅ Structure analyzed → Object with 3 array fields
4. ✅ Backend decision → **MongoDB** (has nested structures)
5. ✅ Data stored → MongoDB as single document
6. ✅ Catalog created → MongoDB with metadata

### **Database Used:**
- **Primary Storage:** MongoDB (Docker)
- **Staging Metadata:** PostgreSQL (Docker)
- **Catalog:** MongoDB

### **Why MongoDB?**
- Your JSON has nested arrays at the top level
- Each array contains complex nested objects
- MongoDB preserves the structure perfectly
- Better for hierarchical/nested data

### **Record Count:**
- **1 document** in MongoDB (contains all users, products, orders)
- **3 users** (inside the document)
- **3 products** (inside the document)
- **3 orders** (inside the document)

---

## 💡 Alternative: If You Want Separate Collections

If you want users, products, and orders in separate collections, you would need to:
1. Upload 3 separate JSON files (one for each)
2. Or modify the pipeline to split the data

But with your current structure, everything is stored as a single document in MongoDB, which is actually perfect for this use case! 🎉

