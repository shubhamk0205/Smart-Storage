import logger from '../utils/logger.js';
import * as ingestService from './ingest.service.js';

/**
 * Handle file ingestion
 * Accepts multiple files and processes them through appropriate pipelines
 */
export const ingestFiles = async (req, res, next) => {
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files were uploaded',
      });
    }

    logger.info(`Received ${req.files.length} file(s) for ingestion`);

    // Process all files through the ingest service
    const results = await ingestService.processFiles(req.files);

    // Return results
    return res.status(200).json({
      success: true,
      message: `Successfully processed ${req.files.length} file(s)`,
      results,
    });
  } catch (error) {
    logger.error('Error in ingestFiles controller:', error);
    next(error);
  }
};
