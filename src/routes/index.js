import express from 'express';
import uploadRoutes from './upload.routes.js';
import datasetRoutes from './dataset.routes.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Storage System is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/upload', uploadRoutes);
router.use('/datasets', datasetRoutes);

export default router;
