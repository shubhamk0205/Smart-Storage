import jsonPipelineService from '../services/json-pipeline.service.js';
import schemaGenerator from '../services/schema-generator.service.js';
import catalogService from '../services/catalog.service.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class JsonOrchestrator {
  /**
   * Process staging file as JSON
   */
  async processStagingFile(stagingFile, datasetName = null) {
    try {
      const ext = stagingFile.filePath.endsWith('.ndjson') ? 'ndjson' : 'json';
      
      // Process JSON file
      const processingResult = await jsonPipelineService.processJson(stagingFile.filePath, ext);
      
      // Generate dataset name if not provided
      const finalDatasetName = datasetName || this.generateDatasetName(stagingFile.originalFilename);
      
      // Generate schemas
      const datasetId = uuidv4();
      const tableName = schemaGenerator.generateTableName(finalDatasetName, datasetId);
      const fieldsObj = processingResult.analysis.fields || {};
      const fields = this.convertFieldsToSchema(fieldsObj);
      const ddl = schemaGenerator.generatePostgresDDL(tableName, fieldsObj);
      const jsonSchema = schemaGenerator.generateJsonSchema(fieldsObj);
      
      // Determine backend (SQL vs NoSQL)
      const backend = this.determineBackend(processingResult.analysis);
      
      // Store data
      let recordCount = 0;
      if (backend === 'sql' && jsonPipelineService.isArrayOfObjects(processingResult.data)) {
        try {
          recordCount = await catalogService.storeInPostgres(tableName, ddl, processingResult.data);
        } catch (error) {
          logger.error('Failed to store in PostgreSQL, using MongoDB:', error);
          recordCount = await catalogService.storeInMongoDB(datasetId, processingResult.data);
        }
      } else {
        recordCount = await catalogService.storeInMongoDB(datasetId, processingResult.data);
      }
      
      // Create dataset catalog entry
      const dataset = await catalogService.createDataset({
        datasetId: datasetId, // Use the same datasetId created earlier
        originalName: stagingFile.originalFilename,
        filePath: stagingFile.filePath,
        fileSize: stagingFile.size,
        mimeType: 'application/json',
        extension: ext,
        category: 'json',
        storage: backend === 'sql' ? 'postgres' : 'mongodb',
        recordCount,
        metadata: processingResult.analysis,
        schema: {
          jsonSchema,
          sqlDDL: ddl,
          tableName,
          fields,
        },
        processing: {
          processed: true,
        },
      });
      
      // Create profile
      const profile = this.createProfile(processingResult.data, fields);
      
      return {
        dataset: {
          name: finalDatasetName,
          backend: backend,
          default_entity: tableName,
          schema_version: '1.0',
          created_at: dataset.createdAt,
          connection_info: backend === 'sql' 
            ? { type: 'postgres', table: tableName }
            : { type: 'mongodb', collection: `dataset_${finalDatasetName}` },
          entities: [tableName],
          tables: backend === 'sql' ? [tableName] : [],
          collections: backend === 'nosql' ? [`dataset_${finalDatasetName}`] : [],
        },
        profile,
      };
    } catch (error) {
      logger.error('Error processing JSON:', error);
      throw error;
    }
  }

  /**
   * Get JSON profile
   */
  async getProfile(filePath) {
    try {
      const ext = filePath.endsWith('.ndjson') ? 'ndjson' : 'json';
      const processingResult = await jsonPipelineService.processJson(filePath, ext);
      const fields = this.convertFieldsToSchema(processingResult.analysis.fields);
      
      return this.createProfile(processingResult.data, fields);
    } catch (error) {
      logger.error('Error getting profile:', error);
      throw error;
    }
  }

  /**
   * Create profile from data and fields
   */
  createProfile(data, fields) {
    const sampleRecords = Array.isArray(data) 
      ? data.slice(0, 3) 
      : [data];
    
    return {
      fields: fields.map(f => ({
        name: f.name,
        type: f.type,
        required: !f.nullable,
        nullable: f.nullable,
        enum: f.enum,
        nested: f.nested,
        array: f.array,
      })),
      sampleRecords,
      recordCount: Array.isArray(data) ? data.length : 1,
    };
  }

  /**
   * Convert fields to schema format
   */
  convertFieldsToSchema(fields) {
    if (!fields) return [];
    
    return Object.entries(fields).map(([name, info]) => ({
      name,
      type: this.inferType(info.types || []),
      nullable: info.nullable || false,
      nested: info.nested || false,
      array: (info.types || []).includes('array'),
      enum: null, // Could be enhanced to detect enums
    }));
  }

  /**
   * Infer type from type array
   */
  inferType(types) {
    if (types.includes('number')) return 'number';
    if (types.includes('boolean')) return 'boolean';
    if (types.includes('string')) return 'string';
    if (types.includes('array')) return 'array';
    if (types.includes('object')) return 'object';
    return 'string';
  }

  /**
   * Determine backend (SQL vs NoSQL)
   */
  determineBackend(analysis) {
    // Simple heuristic: use SQL for tabular data, NoSQL for nested/complex
    if (analysis.fields) {
      const hasNested = Object.values(analysis.fields).some(f => f.nested);
      return hasNested ? 'nosql' : 'sql';
    }
    return 'sql';
  }

  /**
   * Generate dataset name
   */
  generateDatasetName(originalFilename) {
    const name = originalFilename.replace(/\.[^/.]+$/, '');
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }
}

export default new JsonOrchestrator();

