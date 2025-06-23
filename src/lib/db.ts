// app/actions.ts
"use server";
import { neon } from "@neondatabase/serverless";
import env from './env';

// 🚀 CONNECTION POOLING CONFIGURATION
const connectionConfig = {
  // Connection pool settings for production scalability
  connectionTimeoutMillis: 5000, // 5 seconds max to get connection
  idleTimeoutMillis: 30000, // 30 seconds before closing idle connections
  maxLifetimeMillis: 1800000, // 30 minutes max connection lifetime
  maxUses: 7500, // Max uses per connection before rotation
};

// --- LAZY-INITIALIZED SINGLETON FOR DATABASE POOL ---
let dbPool: any = null;

function getDbConnection() {
  if (!dbPool) {
    // Environment validation is assumed to have happened at startup
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Please check your environment variables.');
    }
    // Add timeout for pool creation
    let poolCreated = false;
    const timeout = setTimeout(() => {
      if (!poolCreated) {
        console.error('❌ DB pool creation timed out after 10s');
        throw new Error('DB pool creation timed out after 10s');
      }
    }, 10000);
    try {
      dbPool = neon(env.DATABASE_URL);
      poolCreated = true;
      clearTimeout(timeout);
      console.log('✅ Database connection pool initialized');
    } catch (err) {
      clearTimeout(timeout);
      console.error('❌ Error during DB pool creation:', err);
      throw err;
    }
  }
  return dbPool;
}
// --- END ---

/**
 * Executes a database query with a managed connection and retry logic.
 * This is the primary function for all database interactions.
 */
export async function executeQuery<T = any>(
  queryFn: (sql: any) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const sql = getDbConnection();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn(sql);
    } catch (error: any) {
      lastError = error;
      
      const isRetryableError = 
        error.message?.includes('connection') ||
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.message?.includes('fetch failed') ||
        error.code === 'ECONNRESET';

      if (!isRetryableError || attempt === maxRetries) {
        throw error;
      }

      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      console.warn(`🔄 Database query attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}