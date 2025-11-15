import express from 'express';
import { upload, handleMulterError } from '../middleware/upload.middleware.js';
import * as ingestController from './ingest.controller.js';
import stagingModel from './staging.model.js';
import detectionService from '../detection/detection.service.js';
import mediaService from '../media/media.service.js';
import jsonOrchestrator from '../jsonPipeline/json.orchestrator.js';
import logger from '../utils/logger.js';
import path from 'path';

const router = express.Router();

/**
 * POST /ingest/upload
 * Upload file and create staging record
 */
router.post('/upload', upload.single('file'), handleMulterError, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const datasetName = req.body.datasetName || null;
    const stagingRecord = await stagingModel.create(
      req.file.path,
      req.file.originalname,
      datasetName
    );

    res.status(201).json(stagingRecord);
  } catch (error) {
    logger.error('Error in upload:', error);
    next(error);
  }
});

/**
 * GET /ingest/staging
 * Get all staging files
 */
router.get('/staging', async (req, res, next) => {
  try {
    const files = await stagingModel.getAll();
    res.json(files);
  } catch (error) {
    logger.error('Error getting staging files:', error);
    next(error);
  }
});

/**
 * GET /ingest/staging/:id
 * Get staging file by ID
 */
router.get('/staging/:id', async (req, res, next) => {
  try {
    const file = await stagingModel.getById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'Staging file not found',
      });
    }
    res.json(file);
  } catch (error) {
    logger.error('Error getting staging file:', error);
    next(error);
  }
});

/**
 * POST /ingest/detect/:id
 * Detect and classify staging file
 */
router.post('/detect/:id', async (req, res, next) => {
  try {
    const stagingFile = await stagingModel.getById(req.params.id);
    if (!stagingFile) {
      return res.status(404).json({
        success: false,
        error: 'Staging file not found',
      });
    }

    const detectionResult = await detectionService.detectAndClassify(stagingFile.filePath);
    
    await stagingModel.update(req.params.id, {
      mime_type: detectionResult.mimeType,
      file_kind: detectionResult.fileKind,
      status: 'detected',
    });

    res.json(detectionResult);
  } catch (error) {
    logger.error('Error in detection:', error);
    next(error);
  }
});

/**
 * POST /ingest/process-media/:id
 * Process staging file as media
 */
router.post('/process-media/:id', async (req, res, next) => {
  try {
    const stagingFile = await stagingModel.getById(req.params.id);
    if (!stagingFile) {
      return res.status(404).json({
        success: false,
        error: 'Staging file not found',
      });
    }

    const destinationKey = req.body.destinationKey;
    const mediaAsset = await mediaService.processStagingFile(
      stagingFile,
      destinationKey
    );

    await stagingModel.update(req.params.id, {
      status: 'completed',
    });

    res.json(mediaAsset);
  } catch (error) {
    logger.error('Error processing media:', error);
    await stagingModel.update(req.params.id, {
      status: 'error',
    });
    next(error);
  }
});

/**
 * POST /ingest/process-json/:id
 * Process staging file as JSON
 */
router.post('/process-json/:id', async (req, res, next) => {
  try {
    const stagingFile = await stagingModel.getById(req.params.id);
    if (!stagingFile) {
      return res.status(404).json({
        success: false,
        error: 'Staging file not found',
      });
    }

    const datasetName = req.body.datasetName || stagingFile.datasetName;
    const result = await jsonOrchestrator.processStagingFile(stagingFile, datasetName);

    await stagingModel.update(req.params.id, {
      status: 'completed',
    });

    res.json(result);
  } catch (error) {
    logger.error('Error processing JSON:', error);
    await stagingModel.update(req.params.id, {
      status: 'error',
    });
    next(error);
  }
});

/**
 * GET /ingest/json-profile/:id
 * Get JSON profile for staging file
 */
router.get('/json-profile/:id', async (req, res, next) => {
  try {
    const stagingFile = await stagingModel.getById(req.params.id);
    if (!stagingFile) {
      return res.status(404).json({
        success: false,
        error: 'Staging file not found',
      });
    }

    const profile = await jsonOrchestrator.getProfile(stagingFile.filePath);
    res.json(profile);
  } catch (error) {
    logger.error('Error getting JSON profile:', error);
    next(error);
  }
});

/**
 * DELETE /ingest/staging/:id
 * Delete staging file
 */
router.delete('/staging/:id', async (req, res, next) => {
  try {
    await stagingModel.delete(req.params.id);
    res.json({
      success: true,
      message: 'Staging file deleted',
    });
  } catch (error) {
    logger.error('Error deleting staging file:', error);
    next(error);
  }
});

export default router;
