export interface StagingFile {
  id: string;
  originalFilename: string;
  size: number;
  sha256: string;
  status: 'pending' | 'detected' | 'processing' | 'completed' | 'error';
  createdAt: string;
  mimeType?: string;
  fileKind?: string;
  filePath?: string;
  datasetName?: string;
  processed?: boolean;
  error?: string;
  message?: string;
  dataset?: Dataset;
  mediaAsset?: MediaAsset;
  profile?: JsonProfile;
}

export interface MediaAsset {
  id: string;
  stagingId: string;
  destinationKey: string;
  publicUrl: string;
  sizeBytes: number;
  sha256: string;
  width?: number;
  height?: number;
  duration?: number;
  rawExif?: Record<string, any>;
  mimeType: string;
  originalFilename: string;
  createdAt: string;
}

export interface Dataset {
  name: string;
  backend: 'sql' | 'nosql';
  default_entity: string;
  schema_version: string;
  created_at: string;
  connection_info?: Record<string, any>;
  entities?: string[];
  tables?: string[];
  collections?: string[];
  schema?: {
    jsonSchema?: any;
    sqlDDL?: string;
    tableName?: string;
    fields?: any;
  };
  json_schema?: any;
  sql_ddl?: string;
  fields?: any;
  has_schema?: boolean;
}

export interface JsonProfile {
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    nullable: boolean;
    enum?: string[];
    nested?: boolean;
    array?: boolean;
  }>;
  sampleRecords: any[];
  recordCount: number;
}

export interface Job {
  id: string;
  type: 'ingest' | 'detection' | 'processing' | 'loading';
  status: 'pending' | 'running' | 'completed' | 'error';
  stagingId?: string;
  datasetName?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface DetectionResult {
  mimeType: string;
  fileKind: string;
}

export interface MediaMetadata {
  sizeBytes: number;
  sha256: string;
  width?: number;
  height?: number;
  duration?: number;
  rawExif?: Record<string, any>;
}

export interface AppSettings {
  apiBaseUrl: string;
  mediaRoot: string;
  stagingRoot: string;
  postgresConnection?: string;
  mongoConnection?: string;
  theme: 'light' | 'dark';
}

