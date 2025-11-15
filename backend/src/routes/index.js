import express from 'express';
import uploadRoutes from './upload.routes.js';
import datasetRoutes from './dataset.routes.js';
import ingestRoutes from '../ingest/ingest.routes.js';
import mediaRoutes from '../media/media.routes.js';
import retrievalRoutes from '../retrieval/retrieval.routes.js';
import jobsRoutes from './jobs.routes.js';
import db from '../config/knex.js';
import mongoose from 'mongoose';

const router = express.Router();

// Health check
router.get('/health', async (req, res) => {
  try {
    // Test PostgreSQL
    let postgresOk = false;
    try {
      await db.raw('SELECT 1');
      postgresOk = true;
    } catch (error) {
      // PostgreSQL not available
    }

    // Test MongoDB
    let mongoOk = false;
    try {
      mongoOk = mongoose.connection.readyState === 1;
    } catch (error) {
      // MongoDB not available
    }

    res.json({
      status: 'ok',
      postgres: postgresOk,
      mongo: mongoOk,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// Mount routes
router.use('/upload', uploadRoutes);
router.use('/datasets', datasetRoutes);
router.use('/ingest', ingestRoutes);
router.use('/media', mediaRoutes);
router.use('/retrieve', retrievalRoutes);
router.use('/jobs', jobsRoutes);

export default router;
