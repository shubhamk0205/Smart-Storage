import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file from backend root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');

dotenv.config({ path: envPath });

// Debug: Log DATABASE_URL status
if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL found in environment');
  if (process.env.DATABASE_URL.includes('supabase.co')) {
    console.log('✅ Supabase connection detected');
  }
} else {
  console.warn('⚠️  DATABASE_URL not found - will use fallback connection');
}

// Helper function to parse DATABASE_URL and create connection config
const parseDatabaseUrl = (url) => {
  if (!url) return null;
  
  try {
    const dbUrl = new URL(url);
    const isSupabase = url.includes('supabase.co');
    const isDocker = url.includes('localhost') || url.includes('127.0.0.1');
    
    // For Supabase, use connection object with IPv6 family
    if (isSupabase) {
      return {
        host: dbUrl.hostname,
        port: parseInt(dbUrl.port) || 5432,
        database: dbUrl.pathname.slice(1) || 'postgres',
        user: dbUrl.username || 'postgres',
        password: dbUrl.password || '',
        ssl: { rejectUnauthorized: false },
        family: process.env.FORCE_IPV4 !== 'true' ? 6 : undefined, // Force IPv6 unless explicitly disabled
      };
    }
    
    // For Docker/local connections, use connection object (no SSL needed)
    if (isDocker) {
      return {
        host: dbUrl.hostname,
        port: parseInt(dbUrl.port) || 5432,
        database: dbUrl.pathname.slice(1) || 'smart_storage',
        user: dbUrl.username || 'postgres',
        password: dbUrl.password || '',
        ssl: false,
      };
    }
    
    // For other connections, use connection string
    return {
      connectionString: url,
      ssl: false,
    };
  } catch (error) {
    // Fallback to connection string if parsing fails
    return {
      connectionString: url,
      ssl: url.includes('supabase.co') ? { rejectUnauthorized: false } : false,
    };
  }
};

const config = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL 
      ? parseDatabaseUrl(process.env.DATABASE_URL)
      : {
          host: process.env.PG_HOST || 'localhost',
          port: parseInt(process.env.PG_PORT) || 5432,
          database: process.env.PG_DATABASE || 'smart_storage',
          user: process.env.PG_USER || 'postgres',
          password: process.env.PG_PASSWORD || 'postgres',
          ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
        },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: join(__dirname, '../../migrations'),
      tableName: 'knex_migrations',
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL 
      ? parseDatabaseUrl(process.env.DATABASE_URL)
      : {
          host: process.env.PG_HOST,
          port: parseInt(process.env.PG_PORT),
          database: process.env.PG_DATABASE,
          user: process.env.PG_USER,
          password: process.env.PG_PASSWORD,
          ssl: { rejectUnauthorized: false },
        },
    pool: {
      min: 2,
      max: 20,
    },
    migrations: {
      directory: join(__dirname, '../../migrations'),
      tableName: 'knex_migrations',
    },
  },
};

export default config;
