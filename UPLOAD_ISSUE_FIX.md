# 🔧 Upload Issue - Files Not Appearing in Database

## 🔍 Problem Identified

Your files **ARE** being uploaded to staging, but they're **NOT automatically processed** into the databases.

### Current Status:
- ✅ **Staging Files**: 2 files found in PostgreSQL `staging_files` table
  - `nosql_data.json` - Status: **error** (processing failed)
  - `certificate.png` - Status: **completed** (but may not be in final database)

- ❌ **MongoDB**: No datasets found (JSON file wasn't processed)
- ⚠️ **PostgreSQL**: Media tables exist but may not have all data

## 🎯 Root Cause

The upload endpoint (`POST /api/ingest/upload`) only:
1. ✅ Saves file to disk
2. ✅ Creates staging record in PostgreSQL
3. ❌ **Does NOT automatically process the file**

You need to **manually trigger processing** via separate API calls.

## ✅ Solution 1: Auto-Processing (RECOMMENDED)

I've updated the upload endpoint to support **auto-processing**. Now you can:

### Upload with Auto-Processing:

```bash
# For JSON files
curl -X POST http://localhost:3000/api/ingest/upload \
  -F "file=@data.json" \
  -F "autoProcess=true" \
  -F "datasetName=my_dataset"

# For images
curl -X POST http://localhost:3000/api/ingest/upload \
  -F "file=@image.png" \
  -F "autoProcess=true"
```

### Frontend Usage:
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('autoProcess', 'true');  // Add this!
formData.append('datasetName', 'my_dataset');  // Optional

const response = await fetch('/api/ingest/upload', {
  method: 'POST',
  body: formData
});
```

## ✅ Solution 2: Manual Processing (Current Method)

If you upload without `autoProcess=true`, you need to manually process:

### Step 1: Upload File
```bash
POST /api/ingest/upload
# Returns staging record with ID
```

### Step 2: Detect File Type
```bash
POST /api/ingest/detect/:stagingId
# Detects MIME type and file kind
```

### Step 3: Process File

**For JSON:**
```bash
POST /api/ingest/process-json/:stagingId
Body: { "datasetName": "optional_name" }
```

**For Images/Videos/Audio:**
```bash
POST /api/ingest/process-media/:stagingId
Body: { "destinationKey": "optional_key" }
```

## 🔧 Fix Your Existing Files

### Fix the Failed JSON File:

```bash
# Get the staging ID from the database or API
STAGING_ID="29269d67-c1d6-4285-8977-ac647379aace"

# 1. Detect the file
curl -X POST http://localhost:3000/api/ingest/detect/$STAGING_ID

# 2. Process as JSON
curl -X POST http://localhost:3000/api/ingest/process-json/$STAGING_ID \
  -H "Content-Type: application/json" \
  -d '{"datasetName": "nosql_data"}'
```

### Check Your Image:

```bash
# Get staging ID
STAGING_ID="97b449b0-2437-4797-9f5e-8eac8f88c7c6"

# Check if it's in media tables
curl http://localhost:3000/api/media
```

## 📊 Verify Data is Stored

### Check PostgreSQL Staging:
```bash
curl http://localhost:3000/api/ingest/staging
```

### Check MongoDB Datasets:
```bash
curl http://localhost:3000/api/datasets
```

### Check Media Assets:
```bash
curl http://localhost:3000/api/media
```

## 🎯 Quick Test

### Test Auto-Processing:

1. **Upload a JSON file with auto-processing:**
```bash
curl -X POST http://localhost:3000/api/ingest/upload \
  -F "file=@test.json" \
  -F "autoProcess=true"
```

2. **Check if it's in MongoDB:**
```bash
curl http://localhost:3000/api/datasets
```

3. **Upload an image with auto-processing:**
```bash
curl -X POST http://localhost:3000/api/ingest/upload \
  -F "file=@test.png" \
  -F "autoProcess=true"
```

4. **Check if it's in media:**
```bash
curl http://localhost:3000/api/media
```

## 📝 Summary

### What Was Wrong:
- ❌ Upload endpoint didn't auto-process files
- ❌ Files stayed in staging with status "pending" or "error"
- ❌ Manual processing steps were required

### What's Fixed:
- ✅ Added `autoProcess` parameter to upload endpoint
- ✅ Files can now be automatically processed on upload
- ✅ Better error handling and status updates

### Next Steps:
1. **Update your frontend** to send `autoProcess=true` when uploading
2. **Re-process existing files** using the manual steps above
3. **Test with new uploads** to verify auto-processing works

## 🔍 Debug Commands

Check what's in your databases:

```bash
# Run the diagnostic script
cd backend
node check-uploads.js
```

This will show:
- All staging files
- All media tables and records
- All MongoDB collections and datasets

---

**Your files are in staging - they just need to be processed!** 🎉

