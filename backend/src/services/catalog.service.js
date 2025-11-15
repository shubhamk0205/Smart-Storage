import Dataset from './dataset.model.js';
import db from '../config/knex.js';
import logger from '../utils/logger.js';
import schemaGenerator from './schema-generator.service.js';
import jsonPipeline from './json-pipeline.service.js';

class CatalogService {
  /**
   * Create a new dataset entry in catalog
   * @param {Object} datasetInfo - Dataset information
   * @returns {Promise<Object>} Created dataset
   */
  async createDataset(datasetInfo) {
    try {
      const DatasetModel = Dataset();
      const dataset = new DatasetModel(datasetInfo);
      await dataset.save();

      logger.info(`Dataset cataloged: ${dataset.datasetId}`);
      return dataset;
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
    try {
      const DatasetModel = Dataset();
      const dataset = await DatasetModel.findOne({ datasetId });
      return dataset;
    } catch (error) {
      logger.error('Error fetching dataset:', error);
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
    try {
      const DatasetModel = Dataset();
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;

      const query = DatasetModel.find(filters)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const datasets = await query;
      const total = await DatasetModel.countDocuments(filters);

      return {
        datasets,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error listing datasets:', error);
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
      const DatasetModel = Dataset();
      const dataset = await DatasetModel.findOneAndUpdate(
        { datasetId },
        { $set: updates },
        { new: true }
      );

      logger.info(`Dataset updated: ${datasetId}`);
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
      const DatasetModel = Dataset();
      const dataset = await DatasetModel.findOne({ datasetId });
      if (!dataset) {
        throw new Error('Dataset not found');
      }

      // Delete table if stored in Postgres
      if (dataset.storage === 'postgres' && dataset.schema?.tableName) {
        await this.dropPostgresTable(dataset.schema.tableName);
      }

      await DatasetModel.deleteOne({ datasetId });

      logger.info(`Dataset deleted: ${datasetId}`);
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

      // Flatten and insert data
      const flattenedData = data.map(record =>
        jsonPipeline.flattenObject(record)
      );

      if (flattenedData.length > 0) {
        await db(tableName).insert(flattenedData);
      }

      logger.info(`Stored ${flattenedData.length} records in table: ${tableName}`);
      return flattenedData.length;
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

      // Add metadata to each record
      const documents = data.map(record => ({
        ...record,
        _datasetId: datasetId,
        _importedAt: new Date(),
      }));

      const result = await collection.insertMany(documents);

      logger.info(`Stored ${result.insertedCount} records in collection: ${collectionName}`);
      return result.insertedCount;
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
    try {
      const DatasetModel = Dataset();
      const datasets = await DatasetModel.find({
        $or: [
          { originalName: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
          { tags: { $regex: keyword, $options: 'i' } },
        ],
      }).limit(50);

      return datasets;
    } catch (error) {
      logger.error('Error searching datasets:', error);
      throw error;
    }
  }
}

export default new CatalogService();
