-- Create dataset catalog table for SQL datasets
CREATE TABLE IF NOT EXISTS dataset_catalog (
  id SERIAL PRIMARY KEY,
  dataset_id VARCHAR(255) UNIQUE NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  extension VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('image', 'video', 'audio', 'json', 'text', 'document', 'other', 'unknown')),
  storage VARCHAR(50) NOT NULL CHECK (storage IN ('postgres', 'mongodb', 'file')),
  record_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  dataset_schema JSONB,
  processing JSONB DEFAULT '{"processed": false}',
  tags TEXT[],
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dataset_catalog_dataset_id ON dataset_catalog(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_catalog_category ON dataset_catalog(category);
CREATE INDEX IF NOT EXISTS idx_dataset_catalog_storage ON dataset_catalog(storage);
CREATE INDEX IF NOT EXISTS idx_dataset_catalog_created_at ON dataset_catalog(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dataset_catalog_mime_type ON dataset_catalog(mime_type);

