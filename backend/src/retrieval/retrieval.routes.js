import express from 'express';
import retrievalService from '../services/retrieval.service.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /retrieve
 * Retrieve data from datasets
 */
router.post('/', async (req, res, next) => {
  try {
    const { dataset, entity, filter, fields, include, limit, offset } = req.body;
    
    if (!dataset || !entity) {
      return res.status(400).json({
        success: false,
        error: 'Dataset and entity are required',
      });
    }

    const result = await retrievalService.retrieve({
      dataset,
      entity,
      filter: filter || {},
      fields: fields || [],
      include: include || {},
      limit: limit || 10,
      offset: offset || 0,
    });

    res.json(result);
  } catch (error) {
    logger.error('Error retrieving data:', error);
    next(error);
  }
});

export default router;

