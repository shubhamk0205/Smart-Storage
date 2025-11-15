import express from 'express';
import catalogService from '../services/catalog.service.js';
import retrievalService from '../services/retrieval.service.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * List all datasets
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, backend, sortBy, sortOrder } = req.query;

    const filters = {};
    if (backend) {
      filters.storage = backend === 'sql' ? 'postgres' : 'mongodb';
    }

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 1000,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    };

    const result = await catalogService.listDatasets(filters, options);

    res.json(result.datasets.map(d => ({
      name: d.originalName,
      backend: d.storage === 'postgres' ? 'sql' : 'nosql',
      default_entity: d.schema?.tableName || `dataset_${d.datasetId}`,
      schema_version: '1.0',
      created_at: d.createdAt,
      connection_info: d.storage === 'postgres' 
        ? { type: 'postgres', table: d.schema?.tableName }
        : { type: 'mongodb', collection: `dataset_${d.datasetId}` },
      entities: d.schema?.tableName ? [d.schema.tableName] : [],
      tables: d.storage === 'postgres' && d.schema?.tableName ? [d.schema.tableName] : [],
      collections: d.storage === 'mongodb' ? [`dataset_${d.datasetId}`] : [],
    })));
  } catch (error) {
    logger.error('Error listing datasets:', error);
    next(error);
  }
});

/**
 * Get dataset metadata by name
 */
router.get('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    
    // Try to find by name first
    const datasets = await catalogService.listDatasets({}, { page: 1, limit: 1000 });
    let dataset = datasets.datasets.find(d => d.originalName === name);
    
    // If not found by name, try by ID
    if (!dataset) {
      dataset = await catalogService.getDataset(name);
    }

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found',
      });
    }

    res.json({
      name: dataset.originalName,
      backend: dataset.storage === 'postgres' ? 'sql' : 'nosql',
      default_entity: dataset.schema?.tableName || `dataset_${dataset.datasetId}`,
      schema_version: '1.0',
      created_at: dataset.createdAt,
      connection_info: dataset.storage === 'postgres' 
        ? { type: 'postgres', table: dataset.schema?.tableName }
        : { type: 'mongodb', collection: `dataset_${dataset.datasetId}` },
      entities: dataset.schema?.tableName ? [dataset.schema.tableName] : [],
      tables: dataset.storage === 'postgres' && dataset.schema?.tableName ? [dataset.schema.tableName] : [],
      collections: dataset.storage === 'mongodb' ? [`dataset_${dataset.datasetId}`] : [],
    });
  } catch (error) {
    logger.error('Error getting dataset:', error);
    next(error);
  }
});

/**
 * Get dataset data
 */
router.get('/:datasetId/data', async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const { page, limit, orderBy, sort, ...where } = req.query;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 100,
      where,
      orderBy,
      sort: sort ? JSON.parse(sort) : undefined,
    };

    const result = await retrievalService.retrieveDataset(datasetId, options);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error retrieving dataset data:', error);
    next(error);
  }
});

/**
 * Query dataset
 */
router.post('/:datasetId/query', async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const query = req.body;

    const result = await retrievalService.queryDataset(datasetId, query);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error querying dataset:', error);
    next(error);
  }
});

/**
 * Get dataset statistics
 */
router.get('/:datasetId/stats', async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const stats = await retrievalService.getDatasetStats(datasetId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Error getting dataset stats:', error);
    next(error);
  }
});

/**
 * Update dataset metadata
 */
router.patch('/:datasetId', async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const { tags, description } = req.body;

    const updates = {};
    if (tags !== undefined) updates.tags = tags;
    if (description !== undefined) updates.description = description;

    const dataset = await catalogService.updateDataset(datasetId, updates);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found',
      });
    }

    res.json({
      success: true,
      message: 'Dataset updated successfully',
      dataset: {
        id: dataset.datasetId,
        tags: dataset.tags,
        description: dataset.description,
      },
    });
  } catch (error) {
    logger.error('Error updating dataset:', error);
    next(error);
  }
});

/**
 * Delete dataset
 */
router.delete('/:datasetId', async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    await catalogService.deleteDataset(datasetId);

    res.json({
      success: true,
      message: 'Dataset deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting dataset:', error);
    next(error);
  }
});

/**
 * Search datasets
 */
router.get('/search/:keyword', async (req, res, next) => {
  try {
    const { keyword } = req.params;
    const datasets = await catalogService.searchDatasets(keyword);

    res.json({
      success: true,
      datasets: datasets.map(d => ({
        id: d.datasetId,
        name: d.originalName,
        category: d.category,
        description: d.description,
        tags: d.tags,
      })),
    });
  } catch (error) {
    logger.error('Error searching datasets:', error);
    next(error);
  }
});

export default router;
