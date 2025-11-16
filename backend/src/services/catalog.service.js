import Dataset from './dataset.model.js';
import db from '../config/knex.js';
import logger from '../utils/logger.js';
import schemaGenerator from './schema-generator.service.js';
import jsonPipeline from './json-pipeline.service.js';
import { appConfig } from '../config/app.config.js';
import cacheService from './cache.service.js';

// Ensure dataset_catalog table exists in PostgreSQL
const ensurePostgresCatalogTable = async () => {
  try {
    const exists = await db.schema.hasTable('dataset_catalog');
    if (!exists) {
      await db.schema.createTable('dataset_catalog', (table) => {
        table.increments('id').primary();
        table.string('dataset_id', 255).unique().notNullable();
        table.string('original_name', 500).notNullable();
        table.text('file_path').notNullable();
        table.bigInteger('file_size').notNullable();
        table.string('mime_type', 100).notNullable();
        table.string('extension', 50).notNullable();
        table.string('category', 50).notNullable();
        table.string('storage', 50).notNullable();
        table.integer('record_count').defaultTo(0);
        table.jsonb('metadata');
        table.jsonb('dataset_schema');
        table.jsonb('processing');
        table.specificType('tags', 'TEXT[]');
        table.text('description');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
        
        // Indexes
        table.index('dataset_id');
        table.index('category');
        table.index('storage');
        table.index('created_at');
        table.index('mime_type');
      });
      logger.info('Created dataset_catalog table in PostgreSQL');
    }
  } catch (error) {
    logger.error('Error ensuring dataset_catalog table:', error);
    // Don't throw - allow MongoDB fallback
  }
};

class CatalogService {
  /**
   * Create a new dataset entry in catalog
   * @param {Object} datasetInfo - Dataset information
   * @returns {Promise<Object>} Created dataset
   */
  async createDataset(datasetInfo) {
    try {
      const storage = datasetInfo.storage || 'mongodb';
      
      // SQL datasets go to PostgreSQL catalog
      if (storage === 'postgres') {
        await ensurePostgresCatalogTable();
        
        const [record] = await db('dataset_catalog')
          .insert({
            dataset_id: datasetInfo.datasetId,
            original_name: datasetInfo.originalName,
            file_path: datasetInfo.filePath,
            file_size: datasetInfo.fileSize,
            mime_type: datasetInfo.mimeType,
            extension: datasetInfo.extension,
            category: datasetInfo.category,
            storage: storage,
            record_count: datasetInfo.recordCount || 0,
            metadata: datasetInfo.metadata || {},
            dataset_schema: datasetInfo.datasetSchema || null,
            processing: datasetInfo.processing || { processed: false },
            tags: datasetInfo.tags || [],
            description: datasetInfo.description || null,
          })
          .returning('*');
        
        // Convert to MongoDB-like format for consistency
        const dataset = {
          datasetId: record.dataset_id,
          originalName: record.original_name,
          filePath: record.file_path,
          fileSize: record.file_size,
          mimeType: record.mime_type,
          extension: record.extension,
          category: record.category,
          storage: record.storage,
          recordCount: record.record_count,
          metadata: typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata,
          datasetSchema: typeof record.dataset_schema === 'string' ? JSON.parse(record.dataset_schema) : record.dataset_schema,
          processing: typeof record.processing === 'string' ? JSON.parse(record.processing) : record.processing,
          tags: record.tags || [],
          description: record.description,
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        };
        
        logger.info(`Dataset cataloged in PostgreSQL: ${dataset.datasetId}`);
        
        // Invalidate cache after creating dataset
        await cacheService.invalidateAll(dataset.datasetId);
        
        return dataset;
      } 
      // NoSQL datasets go to MongoDB catalog
      else {
        const DatasetModel = await Dataset(); // Wait for model to be ready
        const dataset = new DatasetModel(datasetInfo);
        await dataset.save();

        logger.info(`Dataset cataloged in MongoDB: ${dataset.datasetId}`);
        
        // Invalidate cache after creating dataset
        await cacheService.invalidateAll(dataset.datasetId);
        
        return dataset;
      }
    } catch (error) {
      logger.error('Error creating dataset:', error);
      throw error;
    }
  }

  /**
   * Get dataset by ID
   * @param {string} datasetId - Dataset ID
   * @returns {Promise<Object>} Dataset information
   */
  async getDataset(datasetId) {
    const startTime = performance.now();
    try {
      // Check cache first
      const cacheKey = cacheService.generateDatasetKey(datasetId);
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        const duration = (performance.now() - startTime).toFixed(2);
        logger.info(`✅ Cache HIT: ${cacheKey} (${duration}ms)`);
        return cached;
      }
      
      logger.debug(`Cache MISS: ${cacheKey}`);
      
      // Fetch from database
      let dataset = null;
      
      // Try PostgreSQL first (SQL datasets)
      try {
        const record = await db('dataset_catalog')
          .where({ dataset_id: datasetId })
          .first();
        
        if (record) {
          dataset = {
            datasetId: record.dataset_id,
            originalName: record.original_name,
            filePath: record.file_path,
            fileSize: record.file_size,
            mimeType: record.mime_type,
            extension: record.extension,
            category: record.category,
            storage: record.storage,
            recordCount: record.record_count,
            metadata: typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata,
            datasetSchema: typeof record.dataset_schema === 'string' ? JSON.parse(record.dataset_schema) : record.dataset_schema,
            processing: typeof record.processing === 'string' ? JSON.parse(record.processing) : record.processing,
            tags: record.tags || [],
            description: record.description,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          };
        }
      } catch (pgError) {
        // PostgreSQL not available or table doesn't exist, try MongoDB
        logger.debug('PostgreSQL catalog lookup failed, trying MongoDB:', pgError.message);
      }
      
      // Try MongoDB (NoSQL datasets) if not found in PostgreSQL
      if (!dataset) {
        const DatasetModel = await Dataset(); // Wait for model to be ready
        dataset = await DatasetModel.findOne({ datasetId });
      }
      
      // Store in cache if found
      if (dataset) {
        const ttl = appConfig.cache?.ttl?.dataset || 3600;
        await cacheService.set(cacheKey, dataset, ttl);
      }
      
      const duration = (performance.now() - startTime).toFixed(2);
      logger.info(`⏱️  getDataset(${datasetId}): ${duration}ms (DB query)`);
      
      return dataset;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      logger.error(`❌ Error fetching dataset (${duration}ms):`, error);
      throw error;
    }
  }

  /**
   * List all datasets with optional filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Pagination options
   * @returns {Promise<Array>} List of datasets
   */
  async listDatasets(filters = {}, options = {}) {
    const startTime = performance.now();
    try {
      // Check cache first
      const cacheKey = cacheService.generateListKey(filters, options);
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        const duration = (performance.now() - startTime).toFixed(2);
        logger.info(`✅ Cache HIT: ${cacheKey} (${duration}ms)`);
        return cached;
      }
      
      logger.debug(`Cache MISS: ${cacheKey}`);
      
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const allDatasets = [];
      
      // Get SQL datasets from PostgreSQL
      try {
        await ensurePostgresCatalogTable();
        
        let pgQuery = db('dataset_catalog');
        
        // Apply filters
        if (filters.storage) {
          pgQuery = pgQuery.where('storage', filters.storage);
        }
        if (filters.category) {
          pgQuery = pgQuery.where('category', filters.category);
        }
        
        const pgDatasets = await pgQuery
          .orderBy(sortBy === 'createdAt' ? 'created_at' : sortBy, sortOrder)
          .limit(limit * 2) // Get more to account for MongoDB results
          .offset((page - 1) * limit);
        
        // Convert PostgreSQL format to MongoDB-like format
        for (const record of pgDatasets) {
          allDatasets.push({
            datasetId: record.dataset_id,
            originalName: record.original_name,
            filePath: record.file_path,
            fileSize: record.file_size,
            mimeType: record.mime_type,
            extension: record.extension,
            category: record.category,
            storage: record.storage,
            recordCount: record.record_count,
            metadata: typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata,
            datasetSchema: typeof record.dataset_schema === 'string' ? JSON.parse(record.dataset_schema) : record.dataset_schema,
            processing: typeof record.processing === 'string' ? JSON.parse(record.processing) : record.processing,
            tags: record.tags || [],
            description: record.description,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          });
        }
      } catch (pgError) {
        logger.debug('PostgreSQL catalog query failed:', pgError.message);
      }
      
      // Get NoSQL datasets from MongoDB
      try {
        const DatasetModel = await Dataset(); // Wait for model to be ready
        
        const mongoFilters = { ...filters };
        // Convert storage filter for MongoDB
        if (filters.storage === 'postgres') {
          // Skip MongoDB if filtering for postgres only
        } else {
          const mongoQuery = DatasetModel.find(mongoFilters)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .limit(limit * 2)
            .skip((page - 1) * limit);
          
          const mongoDatasets = await mongoQuery;
          allDatasets.push(...mongoDatasets);
        }
      } catch (mongoError) {
        logger.debug('MongoDB catalog query failed:', mongoError.message);
      }
      
      // Sort combined results
      allDatasets.sort((a, b) => {
        const aVal = a[sortBy] || a.createdAt;
        const bVal = b[sortBy] || b.createdAt;
        return sortOrder === 'desc' 
          ? (bVal > aVal ? 1 : -1)
          : (aVal > bVal ? 1 : -1);
      });
      
      // Apply pagination to combined results
      const paginatedDatasets = allDatasets.slice((page - 1) * limit, page * limit);
      
      const result = {
        datasets: paginatedDatasets,
        pagination: {
          page,
          limit,
          total: allDatasets.length,
          pages: Math.ceil(allDatasets.length / limit),
        },
      };
      
      // Store in cache
      const ttl = appConfig.cache?.ttl?.list || 300;
      await cacheService.set(cacheKey, result, ttl);
      
      const duration = (performance.now() - startTime).toFixed(2);
      const filterStr = JSON.stringify(filters);
      const optionsStr = `page=${options.page || 1}, limit=${options.limit || 20}`;
      logger.info(`⏱️  listDatasets(${filterStr}, ${optionsStr}): ${duration}ms (DB query)`);
      
      return result;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      logger.error(`❌ Error listing datasets (${duration}ms):`, error);
      throw error;
    }
  }

  /**
   * Update dataset metadata
   * @param {string} datasetId - Dataset ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated dataset
   */
  async updateDataset(datasetId, updates) {
    try {
      // Try PostgreSQL first
      try {
        const record = await db('dataset_catalog')
          .where({ dataset_id: datasetId })
          .first();
        
        if (record) {
          const updateData = {};
          if (updates.tags !== undefined) updateData.tags = updates.tags;
          if (updates.description !== undefined) updateData.description = updates.description;
          if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
          updateData.updated_at = db.fn.now();
          
          const [updated] = await db('dataset_catalog')
            .where({ dataset_id: datasetId })
            .update(updateData)
            .returning('*');
          
          return {
            datasetId: updated.dataset_id,
            originalName: updated.original_name,
            filePath: updated.file_path,
            fileSize: updated.file_size,
            mimeType: updated.mime_type,
            extension: updated.extension,
            category: updated.category,
            storage: updated.storage,
            recordCount: updated.record_count,
            metadata: typeof updated.metadata === 'string' ? JSON.parse(updated.metadata) : updated.metadata,
            datasetSchema: typeof updated.dataset_schema === 'string' ? JSON.parse(updated.dataset_schema) : updated.dataset_schema,
            processing: typeof updated.processing === 'string' ? JSON.parse(updated.processing) : updated.processing,
            tags: updated.tags || [],
            description: updated.description,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          };
        }
      } catch (pgError) {
        logger.debug('PostgreSQL update failed, trying MongoDB:', pgError.message);
      }
      
      // Try MongoDB
      const DatasetModel = await Dataset(); // Wait for model to be ready
      const dataset = await DatasetModel.findOneAndUpdate(
        { datasetId },
        { $set: updates },
        { new: true }
      );

      logger.info(`Dataset updated: ${datasetId}`);
      
      // Invalidate cache after updating dataset
      await cacheService.invalidateAll(datasetId);
      
      return dataset;
    } catch (error) {
      logger.error('Error updating dataset:', error);
      throw error;
    }
  }

  /**
   * Delete dataset
   * @param {string} datasetId - Dataset ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteDataset(datasetId) {
    try {
      // Try PostgreSQL first
      try {
        const record = await db('dataset_catalog')
          .where({ dataset_id: datasetId })
          .first();
        
        if (record) {
          // Delete table if stored in Postgres
          const datasetSchema = typeof record.dataset_schema === 'string' 
            ? JSON.parse(record.dataset_schema) 
            : record.dataset_schema;
          
          if (record.storage === 'postgres' && datasetSchema?.tableName) {
            await this.dropPostgresTable(datasetSchema.tableName);
          }
          
          await db('dataset_catalog')
            .where({ dataset_id: datasetId })
            .delete();
          
          logger.info(`Dataset deleted from PostgreSQL: ${datasetId}`);
          
          // Invalidate cache after deleting dataset
          await cacheService.invalidateAll(datasetId);
          
          return true;
        }
      } catch (pgError) {
        logger.debug('PostgreSQL delete failed, trying MongoDB:', pgError.message);
      }
      
      // Try MongoDB
      const DatasetModel = await Dataset(); // Wait for model to be ready
      const dataset = await DatasetModel.findOne({ datasetId });
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      // Delete table if stored in Postgres (shouldn't happen for MongoDB catalog, but check anyway)
      if (dataset.storage === 'postgres' && dataset.datasetSchema?.tableName) {
        await this.dropPostgresTable(dataset.datasetSchema.tableName);
      }

      await DatasetModel.deleteOne({ datasetId });

      logger.info(`Dataset deleted from MongoDB: ${datasetId}`);
      
      // Invalidate cache after deleting dataset
      await cacheService.invalidateAll(datasetId);
      
      return true;
    } catch (error) {
      logger.error('Error deleting dataset:', error);
      throw error;
    }
  }

  /**
   * Store JSON data in PostgreSQL
   * @param {string} tableName - Table name
   * @param {string} ddl - DDL statement
   * @param {Array} data - Data to insert
   * @returns {Promise<number>} Number of inserted records
   */
  async storeInPostgres(tableName, ddl, data) {
    try {
      // Create table
      await db.raw(ddl);

      // Ensure data is an array
      let dataArray;
      if (Array.isArray(data)) {
        dataArray = data;
      } else if (typeof data === 'object' && data !== null) {
        // Single object - wrap in array
        dataArray = [data];
      } else {
        throw new Error(`Invalid data type for PostgreSQL storage: ${typeof data}. Expected array or object.`);
      }

      // Flatten and insert data
      const flattenedData = dataArray.map(record =>
        jsonPipeline.flattenObject(record)
      );

      if (flattenedData.length > 0) {
        // Batch insert for large datasets to avoid memory issues and improve performance
        const BATCH_SIZE = appConfig.database?.batchSize || 1000;
        let totalInserted = 0;
        
        for (let i = 0; i < flattenedData.length; i += BATCH_SIZE) {
          const batch = flattenedData.slice(i, i + BATCH_SIZE);
          await db(tableName).insert(batch);
          totalInserted += batch.length;
          
          // Log progress for large datasets
          if (flattenedData.length > BATCH_SIZE) {
            logger.debug(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(flattenedData.length / BATCH_SIZE)} (${totalInserted}/${flattenedData.length} records)`);
          }
        }
        
        logger.info(`Stored ${totalInserted} record(s) in table: ${tableName} (in ${Math.ceil(flattenedData.length / BATCH_SIZE)} batch(es))`);
        return totalInserted;
      }

      return 0;
    } catch (error) {
      logger.error('Error storing data in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Store JSON data in MongoDB
   * @param {string} datasetId - Dataset ID
   * @param {Array} data - Data to insert
   * @returns {Promise<number>} Number of inserted records
   */
  async storeInMongoDB(datasetId, data) {
    try {
      const collectionName = `dataset_${datasetId}`;
      const mongoose = (await import('mongoose')).default;
      const db = mongoose.connection.db;
      const collection = db.collection(collectionName);

      // Handle both arrays and single objects
      let documents;
      if (Array.isArray(data)) {
        // Data is already an array
        documents = data.map(record => ({
          ...record,
          _datasetId: datasetId,
          _importedAt: new Date(),
        }));
      } else if (typeof data === 'object' && data !== null) {
        // Data is a single object - wrap it in an array
        documents = [{
          ...data,
          _datasetId: datasetId,
          _importedAt: new Date(),
        }];
      } else {
        throw new Error(`Invalid data type for MongoDB storage: ${typeof data}. Expected array or object.`);
      }

      // Batch insert for large datasets to avoid memory issues and improve performance
      const BATCH_SIZE = appConfig.database?.mongoBatchSize || 1000;
      let totalInserted = 0;
      
      if (documents.length <= BATCH_SIZE) {
        // Small dataset - insert all at once
        const result = await collection.insertMany(documents);
        totalInserted = result.insertedCount;
      } else {
        // Large dataset - insert in batches
        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
          const batch = documents.slice(i, i + BATCH_SIZE);
          const result = await collection.insertMany(batch, {
            ordered: false,  // Continue on error for better performance
          });
          totalInserted += result.insertedCount;
          
          // Log progress for large datasets
          logger.debug(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)} (${totalInserted}/${documents.length} documents)`);
        }
      }

      logger.info(`Stored ${totalInserted} record(s) in collection: ${collectionName}${documents.length > BATCH_SIZE ? ` (in ${Math.ceil(documents.length / BATCH_SIZE)} batch(es))` : ''}`);
      return totalInserted;
    } catch (error) {
      logger.error('Error storing data in MongoDB:', error);
      throw error;
    }
  }

  /**
   * Drop PostgreSQL table
   * @param {string} tableName - Table name to drop
   * @returns {Promise<void>}
   */
  async dropPostgresTable(tableName) {
    try {
      await db.raw(`DROP TABLE IF EXISTS ${tableName}`);
      logger.info(`Dropped table: ${tableName}`);
    } catch (error) {
      logger.error('Error dropping table:', error);
      throw error;
    }
  }

  /**
   * Search datasets by keyword
   * @param {string} keyword - Search keyword
   * @returns {Promise<Array>} Matching datasets
   */
  async searchDatasets(keyword) {
    const startTime = performance.now();
    try {
      // Check cache first
      const cacheKey = cacheService.generateSearchKey(keyword);
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        const duration = (performance.now() - startTime).toFixed(2);
        logger.info(`✅ Cache HIT: ${cacheKey} (${duration}ms)`);
        return cached;
      }
      
      logger.debug(`Cache MISS: ${cacheKey}`);
      
      const allDatasets = [];
      
      // Search PostgreSQL catalog
      try {
        await ensurePostgresCatalogTable();
        
        const pgDatasets = await db('dataset_catalog')
          .where('original_name', 'ilike', `%${keyword}%`)
          .orWhere('description', 'ilike', `%${keyword}%`)
          .limit(50);
        
        for (const record of pgDatasets) {
          allDatasets.push({
            datasetId: record.dataset_id,
            originalName: record.original_name,
            filePath: record.file_path,
            fileSize: record.file_size,
            mimeType: record.mime_type,
            extension: record.extension,
            category: record.category,
            storage: record.storage,
            recordCount: record.record_count,
            metadata: typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata,
            datasetSchema: typeof record.dataset_schema === 'string' ? JSON.parse(record.dataset_schema) : record.dataset_schema,
            processing: typeof record.processing === 'string' ? JSON.parse(record.processing) : record.processing,
            tags: record.tags || [],
            description: record.description,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          });
        }
      } catch (pgError) {
        logger.debug('PostgreSQL search failed:', pgError.message);
      }
      
      // Search MongoDB catalog
      try {
        const DatasetModel = await Dataset(); // Wait for model to be ready
        const mongoDatasets = await DatasetModel.find({
          $or: [
            { originalName: { $regex: keyword, $options: 'i' } },
            { description: { $regex: keyword, $options: 'i' } },
            { tags: { $regex: keyword, $options: 'i' } },
          ],
        }).limit(50);
        
        allDatasets.push(...mongoDatasets);
      } catch (mongoError) {
        logger.debug('MongoDB search failed:', mongoError.message);
      }

      // Store in cache
      const ttl = appConfig.cache?.ttl?.search || 300;
      await cacheService.set(cacheKey, allDatasets, ttl);

      const duration = (performance.now() - startTime).toFixed(2);
      logger.info(`⏱️  searchDatasets("${keyword}"): ${duration}ms (DB query, found ${allDatasets.length} results)`);

      return allDatasets;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      logger.error(`❌ Error searching datasets (${duration}ms):`, error);
      throw error;
    }
  }
}

export default new CatalogService();
