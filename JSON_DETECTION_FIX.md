# 🔧 JSON File Detection Fix

## 🐛 Problem

JSON files were being incorrectly routed to the **media pipeline** instead of the **JSON pipeline**, causing them to be:
- Stored in `media_json` table (PostgreSQL)
- Uploaded to Cloudinary
- NOT processed through JSON pipeline (no schema generation, no MongoDB storage)

## 🔍 Root Cause

The `file-type` library uses **magic bytes** (binary signatures) to detect file types. JSON files are **plain text**, not binary, so:
- `fileTypeFromFile()` returns `null` for JSON files
- Code defaults to `application/octet-stream` with category `unknown`
- File gets misrouted or falls through to wrong pipeline

## ✅ Fix Applied

### 1. **Enhanced File Type Detection** (`backend/src/services/file-type.service.js`)

**Before:**
- Only used magic bytes detection
- JSON files returned `null` → defaulted to `unknown`

**After:**
- **Checks file extension FIRST** (for text-based files like JSON)
- Falls back to magic bytes for binary files
- Falls back to content analysis if both fail

**New Detection Flow:**
```
1. Check file extension (.json, .ndjson, etc.)
   ↓ If JSON extension found
2. Read file content sample
   ↓ Verify it's valid JSON
3. Return: { mime: 'application/json', category: 'json' }
   ↓ If extension check fails
4. Try magic bytes detection (for binary files)
   ↓ If that fails
5. Try content-based text format detection
```

### 2. **Added Safeguards in Media Pipeline**

**Media Service** (`backend/src/media/media.service.js`):
- Added check to reject JSON files
- Throws error if JSON file somehow reaches media pipeline

**Media Pipeline Service** (`backend/src/services/media-pipeline.service.js`):
- Added check at the start of `processMedia()`
- Prevents JSON files from being processed as media

## 🎯 How It Works Now

### JSON File Upload Flow:

```
1. File uploaded: nosql_data.json
   ↓
2. detectFromFile() called
   ↓
3. Extension check: .json → detected!
   ↓
4. Content verification: Reads sample, validates JSON
   ↓
5. Returns: { mime: 'application/json', category: 'json' }
   ↓
6. Routing decision: category === 'json'
   ↓
7. Routes to: JSON Pipeline ✅
   ↓
8. Processes through JSON orchestrator
   ↓
9. Generates schemas
   ↓
10. Stores in MongoDB (or PostgreSQL if tabular)
```

## 📊 Detection Priority

1. **Extension-based** (for text files: JSON, CSV, TXT)
2. **Magic bytes** (for binary files: images, videos, PDFs)
3. **Content analysis** (fallback for text formats)

## 🧪 Testing

### Test JSON Detection:

```bash
# Upload a JSON file
curl -X POST http://localhost:3000/api/ingest/upload \
  -F "file=@test.json" \
  -F "autoProcess=true"
```

**Expected Result:**
- ✅ Detected as: `application/json`, category: `json`
- ✅ Routed to: JSON Pipeline
- ✅ Stored in: MongoDB (or PostgreSQL if tabular)
- ✅ Schema generated
- ❌ NOT stored in: `media_json` table
- ❌ NOT uploaded to: Cloudinary

## 🔄 Fixing Existing Files

If you have JSON files already in `media_json` table:

1. **Delete the incorrect media record:**
```sql
DELETE FROM media_json WHERE original_filename LIKE '%.json';
```

2. **Re-process the staging file:**
```bash
# Get staging ID
STAGING_ID="29269d67-c1d6-4285-8977-ac647379aace"

# Process as JSON
curl -X POST http://localhost:3000/api/ingest/process-json/$STAGING_ID \
  -H "Content-Type: application/json" \
  -d '{"datasetName": "nosql_data"}'
```

## ✅ Summary

- ✅ JSON files now detected by extension first
- ✅ Content verification ensures it's actually JSON
- ✅ Safeguards prevent JSON files from media pipeline
- ✅ Proper routing to JSON pipeline
- ✅ Schema generation works correctly
- ✅ Data stored in correct database (MongoDB/PostgreSQL)

Your JSON files will now be processed correctly! 🎉

