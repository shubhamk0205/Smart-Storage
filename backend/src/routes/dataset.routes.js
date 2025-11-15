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
    const { page, limit, category, sortBy, sortOrder } = req.query;

    const filters = {};
    if (category) {
      filters.category = category;
    }

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    };

    const result = await catalogService.listDatasets(filters, options);

    res.json({
      success: true,
      datasets: result.datasets.map(d => ({
        id: d.datasetId,
        name: d.originalName,
        category: d.category,
        mimeType: d.mimeType,
        storage: d.storage,
        recordCount: d.recordCount,
        fileSize: d.fileSize,
        createdAt: d.createdAt,
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Error listing datasets:', error);
    next(error);
  }
});

/**
 * Get dataset metadata
 */
router.get('/:datasetId', async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const dataset = await catalogService.getDataset(datasetId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found',
      });
    }

    res.json({
      success: true,
      dataset: {
        id: dataset.datasetId,
        name: dataset.originalName,
        category: dataset.category,
        mimeType: dataset.mimeType,
        extension: dataset.extension,
        storage: dataset.storage,
        recordCount: dataset.recordCount,
        fileSize: dataset.fileSize,
        metadata: dataset.metadata,
        schema: dataset.schema,
        processing: dataset.processing,
        tags: dataset.tags,
        description: dataset.description,
        createdAt: dataset.createdAt,
        updatedAt: dataset.updatedAt,
      },
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
