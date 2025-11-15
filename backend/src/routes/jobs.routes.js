import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

// In-memory job store (in production, use a database)
const jobs = [];

/**
 * GET /jobs
 * Get all jobs
 */
router.get('/', async (req, res, next) => {
  try {
    // Return jobs sorted by creation date (newest first)
    const sortedJobs = [...jobs].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json(sortedJobs);
  } catch (error) {
    logger.error('Error getting jobs:', error);
    next(error);
  }
});

/**
 * GET /jobs/:id
 * Get job by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const job = jobs.find(j => j.id === req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }
    res.json(job);
  } catch (error) {
    logger.error('Error getting job:', error);
    next(error);
  }
});

/**
 * POST /jobs/:id/retry
 * Retry failed job
 */
router.post('/:id/retry', async (req, res, next) => {
  try {
    const job = jobs.find(j => j.id === req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Create new job with same parameters
    const newJob = {
      id: `job_${Date.now()}`,
      type: job.type,
      status: 'pending',
      stagingId: job.stagingId,
      datasetName: job.datasetName,
      createdAt: new Date().toISOString(),
    };

    jobs.push(newJob);

    res.json(newJob);
  } catch (error) {
    logger.error('Error retrying job:', error);
    next(error);
  }
});

// Helper function to create jobs (called by other services)
export const createJob = (type, stagingId, datasetName = null) => {
  const job = {
    id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    status: 'pending',
    stagingId,
    datasetName,
    createdAt: new Date().toISOString(),
  };
  jobs.push(job);
  return job;
};

// Helper function to update job status
export const updateJob = (id, updates) => {
  const job = jobs.find(j => j.id === id);
  if (job) {
    Object.assign(job, updates);
    if (updates.status === 'completed' || updates.status === 'error') {
      job.completedAt = new Date().toISOString();
    }
  }
  return job;
};

export default router;

