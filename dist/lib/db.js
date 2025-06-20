"use strict";
// app/actions.ts
"use server";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeQuery = executeQuery;
const serverless_1 = require("@neondatabase/serverless");
const env_1 = __importDefault(require("./env"));
// 🚀 CONNECTION POOLING CONFIGURATION
const connectionConfig = {
    // Connection pool settings for production scalability
    connectionTimeoutMillis: 5000, // 5 seconds max to get connection
    idleTimeoutMillis: 30000, // 30 seconds before closing idle connections
    maxLifetimeMillis: 1800000, // 30 minutes max connection lifetime
    maxUses: 7500, // Max uses per connection before rotation
};
// --- LAZY-INITIALIZED SINGLETON FOR DATABASE POOL ---
let dbPool = null;
function getDbConnection() {
    if (!dbPool) {
        // Environment validation is assumed to have happened at startup
        if (!env_1.default.DATABASE_URL) {
            throw new Error('DATABASE_URL is not set. Please check your environment variables.');
        }
        // Create the connection pool only once
        dbPool = (0, serverless_1.neon)(env_1.default.DATABASE_URL);
        console.log('✅ Database connection pool initialized');
    }
    return dbPool;
}
// --- END ---
/**
 * Executes a database query with a managed connection and retry logic.
 * This is the primary function for all database interactions.
 */
async function executeQuery(queryFn, maxRetries = 3) {
    const sql = getDbConnection();
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn(sql);
        }
        catch (error) {
            lastError = error;
            const isRetryableError = error.message?.includes('connection') ||
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
    throw lastError;
}
