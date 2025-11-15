import mongoose from 'mongoose';
import { databaseConfig } from './database.js';
import logger from '../utils/logger.js';

const connectMongoDB = async () => {
  try {
    // Ensure we're not already connected
    if (mongoose.connection.readyState === 1) {
      logger.info('MongoDB already connected');
      return;
    }

    await mongoose.connect(databaseConfig.mongo.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    // Wait for connection to be fully established
    await new Promise((resolve, reject) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
        return;
      }
      
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('MongoDB connection timeout'));
      }, 10000);
    });
    
    // Connection will be logged by the 'connected' event handler below
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error; // Don't exit, let the server handle it
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
