import express from 'express';
import mediaService from './media.service.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /media
 * Get all media assets
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      mime_type: req.query.mime_type,
      original_filename: req.query.original_filename,
      sha256: req.query.sha256,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );
    
    const assets = await mediaService.getAllMediaAssets(filters);
    res.json(assets);
  } catch (error) {
    logger.error('Error getting media assets:', error);
    next(error);
  }
});

/**
 * GET /media/:id
 * Get media asset by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const asset = await mediaService.getMediaAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Media asset not found',
      });
    }
    res.json(asset);
  } catch (error) {
    logger.error('Error getting media asset:', error);
    next(error);
  }
});

export default router;

