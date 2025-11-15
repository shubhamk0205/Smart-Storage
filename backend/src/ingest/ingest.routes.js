import express from 'express';
import { upload, handleMulterError } from '../middleware/upload.middleware.js';
import * as ingestController from './ingest.controller.js';

const router = express.Router();

/**
 * POST /ingest
 * Accepts multiple files of any type (images, videos, JSON, etc.)
 * Files are processed and routed to appropriate pipelines
 */
router.post(
  '/',
  upload.array('files', 20), // Accept up to 20 files with field name 'files'
  ingestController.ingestFiles
);

// Multer error handling
router.use(handleMulterError);

export default router;
