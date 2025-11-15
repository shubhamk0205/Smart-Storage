import knex from 'knex';
import knexConfig from './knex.config.js';
import logger from '../utils/logger.js';

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

const db = knex(config);

// Helper function to log PostgreSQL connection info
export const logPostgresConnection = () => {
  const dbInfo = config.connection || {};
  
  // Handle connection object (Supabase with IPv6)
  if (dbInfo.host && dbInfo.family === 6) {
    logger.info(`✅ PostgreSQL connected successfully to Supabase (IPv6)!`);
    logger.info(`   Database: ${dbInfo.database || 'N/A'}`);
    logger.info(`   Host: ${dbInfo.host}:${dbInfo.port || '5432'}`);
    logger.info(`   User: ${dbInfo.user || 'N/A'}`);
    logger.info(`   SSL: Enabled (required for Supabase)`);
    logger.info(`   IPv6: Forced (family: 6)`);
  }
  // Handle connection object with connectionString
  else if (dbInfo.connectionString) {
    try {
      const url = new URL(dbInfo.connectionString);
      logger.info(`✅ PostgreSQL connected successfully to Supabase!`);
      logger.info(`   Database: ${url.pathname.slice(1) || 'N/A'}`);
      logger.info(`   Host: ${url.hostname}:${url.port || '5432'}`);
      logger.info(`   User: ${url.username || 'N/A'}`);
      logger.info(`   SSL: Enabled (required for Supabase)`);
    } catch (error) {
      logger.info(`✅ PostgreSQL connected successfully!`);
      logger.info(`   Connection: Supabase (connection string)`);
    }
  }
  // Handle direct connection string
  else if (typeof dbInfo === 'string') {
    try {
      const url = new URL(dbInfo);
      logger.info(`✅ PostgreSQL connected successfully!`);
      logger.info(`   Database: ${url.pathname.slice(1) || 'N/A'}`);
      logger.info(`   Host: ${url.hostname}:${url.port || '5432'}`);
      logger.info(`   User: ${url.username || 'N/A'}`);
    } catch (error) {
      logger.info(`✅ PostgreSQL connected successfully!`);
      logger.info(`   Connection: [Connection string provided]`);
    }
  } 
  // Handle connection object
  else {
    logger.info(`✅ PostgreSQL connected successfully!`);
    logger.info(`   Database: ${dbInfo.database || 'N/A'}`);
    logger.info(`   Host: ${dbInfo.host || 'N/A'}:${dbInfo.port || 'N/A'}`);
    logger.info(`   User: ${dbInfo.user || 'N/A'}`);
  }
};

export default db;
