import mongoose from 'mongoose';
import { databaseConfig } from './database.js';
import logger from '../utils/logger.js';

const connectMongoDB = async () => {
  try {
    await mongoose.connect(databaseConfig.mongo.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

export default connectMongoDB;
