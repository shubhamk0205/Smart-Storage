# 🔧 Schema Generation Tools & Methods

## Answer: No External DDL Generation Tool

**The SQL DDL is generated using custom-built code, not any external tool or library.**

---

## Tools/Libraries Used

### 1. **Ajv (Another JSON Schema Validator)**
- **Package:** `ajv@^8.12.0`
- **Purpose:** JSON Schema **validation** only (NOT generation)
- **Usage:** Validates data against generated JSON Schema
- **Location:** `backend/src/services/schema-generator.service.js:1, 6, 193-200`

```javascript
import Ajv from 'ajv';

class SchemaGeneratorService {
  constructor() {
    this.ajv = new Ajv();  // Only for validation
  }
  
  // Used only for validation, not generation
  validateAgainstSchema(schema, data) {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);
    return { valid, errors: validate.errors };
  }
}
```

**Note:** Ajv is **NOT** used for generating schemas, only for validating data against schemas.

---

## Custom-Built Schema Generation

### SQL DDL Generation

**Location:** `backend/src/services/schema-generator.service.js:15-30`

**Method:** Manual string construction

```javascript
generatePostgresDDL(tableName, fields) {
  // Step 1: Start with default columns
  const columns = [
    'id SERIAL PRIMARY KEY',
    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  ];

  // Step 2: Loop through fields and build column definitions
  for (const [fieldName, fieldInfo] of Object.entries(fields)) {
    const columnName = this.sanitizeIdentifier(fieldName);
    const columnType = this.mapToPostgresType(fieldInfo);  // Custom mapping
    const nullable = fieldInfo.nullable ? '' : ' NOT NULL';

    // Step 3: Build column definition string
    columns.push(`${columnName} ${columnType}${nullable}`);
  }

  // Step 4: Construct final DDL string
  const ddl = `CREATE TABLE IF NOT EXISTS ${this.sanitizeIdentifier(tableName)} (\n  ${columns.join(',\n  ')}\n);`;

  return ddl;
}
```

**Key Points:**
- ✅ **No external DDL generator** - All SQL is manually constructed
- ✅ **Custom type mapping** - `mapToPostgresType()` converts JavaScript types to PostgreSQL types
- ✅ **String concatenation** - Uses template literals and `join()` to build SQL

---

### JSON Schema Generation

**Location:** `backend/src/services/schema-generator.service.js:74-96`

**Method:** Manual object construction

```javascript
generateJsonSchema(fields) {
  const properties = {};
  const required = [];

  // Step 1: Build properties object
  for (const [fieldName, fieldInfo] of Object.entries(fields)) {
    const property = this.mapToJsonSchemaType(fieldInfo);  // Custom mapping
    properties[fieldName] = property;

    // Step 2: Track required fields
    if (!fieldInfo.nullable) {
      required.push(fieldName);
    }
  }

  // Step 3: Construct JSON Schema object
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };

  return schema;
}
```

**Key Points:**
- ✅ **No external JSON Schema generator** - Schema object is manually constructed
- ✅ **Custom type mapping** - `mapToJsonSchemaType()` converts JavaScript types to JSON Schema types
- ✅ **Object construction** - Uses plain JavaScript objects

---

## Type Mapping (Custom Logic)

### PostgreSQL Type Mapping

**Location:** `backend/src/services/schema-generator.service.js:37-67`

```javascript
mapToPostgresType(fieldInfo) {
  const types = fieldInfo.types || [];

  // Custom logic for nested structures
  if (fieldInfo.nested) {
    return 'JSONB';
  }

  // Custom logic for multiple types
  if (types.length > 1) {
    if (types.includes('string')) return 'TEXT';
    if (types.includes('number')) return 'DOUBLE PRECISION';
    return 'JSONB';
  }

  // Custom switch statement for single types
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

**This is all custom logic - no library does this mapping.**

---

## Why Custom-Built?

### Advantages:
1. ✅ **Full Control** - Complete control over DDL structure and formatting
2. ✅ **Lightweight** - No heavy dependencies for schema generation
3. ✅ **Customizable** - Easy to modify type mappings and DDL structure
4. ✅ **Simple** - Straightforward string/object construction
5. ✅ **No External Dependencies** - Reduces package size and complexity

### Trade-offs:
- ⚠️ **Manual Maintenance** - Need to manually update type mappings if PostgreSQL adds new types
- ⚠️ **No Advanced Features** - Don't get advanced features from DDL generation libraries
- ⚠️ **Testing Required** - Need to test all type combinations manually

---

## What Could Be Used Instead?

### Potential DDL Generation Libraries:

1. **Knex.js Schema Builder** (Already installed, but not used for DDL generation)
   - **Package:** `knex@^3.1.0`
   - **Current Usage:** Only for database queries and migrations
   - **Could Use:** `knex.schema.createTable()` to build DDL
   - **Why Not Used:** We need raw DDL strings, not just table creation

2. **pg-structure** (Not installed)
   - PostgreSQL schema introspection and generation
   - **Why Not Used:** Overkill for our use case

3. **sql-ddl-to-json-schema** (Not installed)
   - Converts DDL to JSON Schema (opposite direction)
   - **Why Not Used:** We go from JSON to DDL, not DDL to JSON

4. **json-schema-to-sql** (Not installed)
   - Converts JSON Schema to SQL DDL
   - **Why Not Used:** We generate both simultaneously from field analysis

---

## Summary

| Component | Method | Tool/Library |
|-----------|--------|--------------|
| **SQL DDL Generation** | Custom-built | ❌ None (manual string construction) |
| **JSON Schema Generation** | Custom-built | ❌ None (manual object construction) |
| **Type Mapping** | Custom logic | ❌ None (switch statements) |
| **Schema Validation** | Ajv library | ✅ `ajv@^8.12.0` (validation only) |
| **Database Queries** | Knex.js | ✅ `knex@^3.1.0` (queries, not DDL generation) |

---

## Code Flow

```
Field Analysis (from JSON)
    │
    ▼
Custom Type Mapping
    │
    ├─→ mapToPostgresType() → PostgreSQL types
    └─→ mapToJsonSchemaType() → JSON Schema types
    │
    ▼
Custom String/Object Construction
    │
    ├─→ generatePostgresDDL() → SQL DDL string
    └─→ generateJsonSchema() → JSON Schema object
    │
    ▼
Generated Schemas (ready to use)
```

**All generation is custom-built. No external DDL generation tools are used.**

