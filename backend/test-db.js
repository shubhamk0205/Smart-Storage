#!/usr/bin/env node

import db from './src/config/knex.js';
import logger from './src/utils/logger.js';

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');

    // Test the connection
    await db.raw('SELECT 1+1 AS result');

    console.log('✅ PostgreSQL connection successful!');

    // Get database version
    const result = await db.raw('SELECT version()');
    console.log('Database version:', result.rows[0].version);

    // Close the connection
    await db.destroy();

    process.exit(0);
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. PostgreSQL is running (run: pg_isready)');
    console.error('2. Database "smart_storage" exists (run: createdb smart_storage)');
    console.error('3. .env file has correct credentials');

    process.exit(1);
  }
}

testConnection();
