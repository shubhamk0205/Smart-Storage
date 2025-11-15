import catalogService from './catalog.service.js';
import db from '../config/knex.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class RetrievalService {
  /**
   * Retrieve dataset data in unified JSON format
   * @param {string} datasetId - Dataset ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Dataset with data
   */
  async retrieveDataset(datasetId, options = {}) {
    try {
      const dataset = await catalogService.getDataset(datasetId);
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      let data;

      switch (dataset.storage) {
        case 'postgres':
          data = await this.retrieveFromPostgres(dataset, options);
          break;
        case 'mongodb':
          data = await this.retrieveFromMongoDB(dataset, options);
          break;
        case 'file':
          data = await this.retrieveFromFile(dataset);
          break;
        default:
          throw new Error(`Unknown storage type: ${dataset.storage}`);
      }

      return {
        dataset: {
          id: dataset.datasetId,
          name: dataset.originalName,
          category: dataset.category,
          mimeType: dataset.mimeType,
          recordCount: dataset.recordCount,
          createdAt: dataset.createdAt,
          metadata: dataset.metadata,
        },
        data,
        pagination: options.page ? {
          page: options.page,
          limit: options.limit,
          total: dataset.recordCount,
        } : null,
      };
    } catch (error) {
      logger.error('Error retrieving dataset:', error);
      throw error;
    }
  }

  /**
   * Retrieve data from PostgreSQL
   * @param {Object} dataset - Dataset metadata
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Data records
   */
  async retrieveFromPostgres(dataset, options = {}) {
    try {
      const { page = 1, limit = 100, where = {}, orderBy = 'id' } = options;
      const tableName = dataset.datasetSchema?.tableName;

      if (!tableName) {
        throw new Error('Table name not found in dataset schema');
      }

      let query = db(tableName);

      // Apply filters
      if (Object.keys(where).length > 0) {
        query = query.where(where);
      }

      // Apply pagination
      if (page && limit) {
        query = query.limit(limit).offset((page - 1) * limit);
      }

      // Apply ordering
      query = query.orderBy(orderBy);

      const records = await query;

      // Convert PostgreSQL records to nested JSON
      const data = records.map(record => this.unflattenObject(record));

      logger.info(`Retrieved ${data.length} records from table: ${tableName}`);
      return data;
    } catch (error) {
      logger.error('Error retrieving from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Retrieve data from MongoDB
   * @param {Object} dataset - Dataset metadata
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Data records
   */
  async retrieveFromMongoDB(dataset, options = {}) {
    try {
      const { page = 1, limit = 100, where = {}, sort = { _id: 1 } } = options;
      const collectionName = `dataset_${dataset.datasetId}`;
      const db = mongoose.connection.db;
      const collection = db.collection(collectionName);

      const records = await collection
        .find(where)
        .sort(sort)
        .limit(limit)
        .skip((page - 1) * limit)
        .toArray();

      // Remove internal fields
      const data = records.map(record => {
        const { _id, _datasetId, _importedAt, ...cleanRecord } = record;
        return cleanRecord;
      });

      logger.info(`Retrieved ${data.length} records from collection: ${collectionName}`);
      return data;
    } catch (error) {
      logger.error('Error retrieving from MongoDB:', error);
      throw error;
    }
  }

  /**
   * Retrieve data from file (for media files)
   * @param {Object} dataset - Dataset metadata
   * @returns {Promise<Object>} File information
   */
  async retrieveFromFile(dataset) {
    try {
      return {
        filePath: dataset.filePath,
        thumbnailPath: dataset.processing?.thumbnailPath,
        metadata: dataset.metadata,
      };
    } catch (error) {
      logger.error('Error retrieving file information:', error);
      throw error;
    }
  }

  /**
   * Unflatten object (reverse of flatten operation)
   * @param {Object} flatObj - Flattened object
   * @returns {Object} Nested object
   */
  unflattenObject(flatObj) {
    const result = {};

    for (const [key, value] of Object.entries(flatObj)) {
      // Skip metadata fields
      if (key === 'id' || key === 'created_at') {
        continue;
      }

      const parts = key.split('_');
      let current = result;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      // Try to parse JSON strings back to arrays/objects
      let finalValue = value;
      if (typeof value === 'string') {
        try {
          finalValue = JSON.parse(value);
        } catch (e) {
          // Keep as string if not valid JSON
          finalValue = value;
        }
      }

      current[parts[parts.length - 1]] = finalValue;
    }

    return result;
  }

  /**
   * Query dataset with advanced filters
   * @param {string} datasetId - Dataset ID
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Query results
   */
  async queryDataset(datasetId, query) {
    try {
      const dataset = await catalogService.getDataset(datasetId);
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      const options = {
        page: parseInt(query.page) || 1,
        limit: parseInt(query.limit) || 100,
        where: query.where || {},
        orderBy: query.orderBy || 'id',
        sort: query.sort || { _id: 1 },
      };

      return await this.retrieveDataset(datasetId, options);
    } catch (error) {
      logger.error('Error querying dataset:', error);
      throw error;
    }
  }

  /**
   * Get dataset statistics
   * @param {string} datasetId - Dataset ID
   * @returns {Promise<Object>} Statistics
   */
  async getDatasetStats(datasetId) {
    try {
      const dataset = await catalogService.getDataset(datasetId);
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      const stats = {
        datasetId: dataset.datasetId,
        name: dataset.originalName,
        category: dataset.category,
        storage: dataset.storage,
        recordCount: dataset.recordCount,
        fileSize: dataset.fileSize,
        createdAt: dataset.createdAt,
        schema: dataset.datasetSchema?.fields,
      };

      return stats;
    } catch (error) {
      logger.error('Error getting dataset stats:', error);
      throw error;
    }
  }

  /**
   * Unified retrieve method for frontend
   */
  async retrieve(params) {
    try {
      const { dataset, entity, filter = {}, fields = [], include = {}, limit = 10, offset = 0 } = params;
      
      // Get dataset by name
      const datasets = await catalogService.listDatasets({}, { page: 1, limit: 1000 });
      const datasetObj = datasets.datasets.find(d => d.originalName === dataset || d.datasetId === dataset);
      
      if (!datasetObj) {
        throw new Error(`Dataset not found: ${dataset}`);
      }

      // Build query options
      const options = {
        page: Math.floor(offset / limit) + 1,
        limit,
        where: filter,
        orderBy: 'id',
      };

      // Get data
      let data;
      if (datasetObj.storage === 'postgres') {
        const tableName = datasetObj.datasetSchema?.tableName || entity;
        let query = db(tableName);
        
        if (Object.keys(filter).length > 0) {
          query = query.where(filter);
        }
        
        if (fields.length > 0) {
          query = query.select(fields);
        } else {
          query = query.select('*');
        }
        
        query = query.limit(limit).offset(offset);
        data = await query;
      } else {
        const collectionName = `dataset_${datasetObj.datasetId}`;
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        let mongoQuery = collection.find(filter);
        
        if (fields.length > 0) {
          const projection = {};
          fields.forEach(field => {
            projection[field] = 1;
          });
          mongoQuery = mongoQuery.project(projection);
        }
        
        data = await mongoQuery.limit(limit).skip(offset).toArray();
        data = data.map(record => {
          const { _id, _datasetId, _importedAt, ...cleanRecord } = record;
          return cleanRecord;
        });
      }

      return data;
    } catch (error) {
      logger.error('Error in retrieve:', error);
      throw error;
    }
  }
}

export default new RetrievalService();
