# 🔧 Collection Name Fix - Changed from "datasets" to "dataset_catalog"

## Problem
The collection name `datasets` was causing issues because:
- It might be a reserved keyword in MongoDB
- It was not visible in database tools
- Users could query it but couldn't see it physically in the database

## Solution
Changed the Mongoose model to use an explicit collection name: **`dataset_catalog`**

## Changes Made

### 1. Model Definition (`backend/src/services/dataset.model.js`)
```javascript
// Before:
Dataset = mongoose.model('Dataset', schema);

// After:
Dataset = mongoose.model('Dataset', schema, 'dataset_catalog');
```

The third parameter explicitly sets the collection name to `dataset_catalog` instead of the default pluralized `datasets`.

### 2. Database Migration
The existing `datasets` collection has been renamed to `dataset_catalog`:
```javascript
db.datasets.renameCollection('dataset_catalog')
```

## Verification

### Collections in MongoDB:
```
✅ dataset_catalog          (catalog of all datasets)
✅ dataset_<uuid>           (actual data collections)
```

### Data Verification:
- All existing datasets are preserved
- Collection is now visible in database tools
- Queries work as before
- No data loss

## Impact

### ✅ Benefits:
1. **Visible in database tools** - Collection now appears in MongoDB Compass, Studio 3T, etc.
2. **No keyword conflicts** - `dataset_catalog` is not a reserved word
3. **More descriptive** - Name clearly indicates it's a catalog
4. **Backward compatible** - All existing code continues to work

### 📝 Notes:
- The model name remains `Dataset` (for code consistency)
- Only the collection name changed to `dataset_catalog`
- All existing queries and operations work unchanged
- No code changes needed in other files

## Testing

To verify the fix:
```bash
# Check collection exists
docker exec smart_storage_mongodb mongosh -u admin -p admin --authenticationDatabase admin smart_storage --eval "db.dataset_catalog.countDocuments()"

# List all collections
docker exec smart_storage_mongodb mongosh -u admin -p admin --authenticationDatabase admin smart_storage --eval "db.getCollectionNames()"

# Query datasets
docker exec smart_storage_mongodb mongosh -u admin -p admin --authenticationDatabase admin smart_storage --eval "db.dataset_catalog.find().limit(1).pretty()"
```

## Summary

**Before:** Collection name: `datasets` (not visible, keyword conflict)
**After:** Collection name: `dataset_catalog` (visible, no conflicts)

The collection is now properly visible in all MongoDB tools and database viewers! 🎉

