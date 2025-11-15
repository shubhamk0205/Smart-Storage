import dotenv from 'dotenv';

dotenv.config();

export const databaseConfig = {
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT) || 5432,
    database: process.env.PG_DATABASE || 'smart_storage',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/smart_storage',
  },
};
