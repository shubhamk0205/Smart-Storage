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
    
    // Connection will be logged by the 'connected' event handler below
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  const dbName = mongoose.connection.name;
  const host = mongoose.connection.host;
  const port = mongoose.connection.port;
  logger.info(`✅ MongoDB connected successfully!`);
  logger.info(`   Database: ${dbName}`);
  logger.info(`   Host: ${host}:${port}`);
  logger.info(`   Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});

mongoose.connection.on('error', (err) => {
  logger.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('🔄 MongoDB reconnected successfully');
});

export default connectMongoDB;
