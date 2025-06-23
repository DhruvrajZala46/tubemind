"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.getRedisConfig = getRedisConfig;
exports.initializeRedis = initializeRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('redis-client');
let redis = null;
exports.redis = redis;
let redisInitializationPromise = null;
// This function centralizes the logic for getting the Redis connection configuration.
function getRedisConfig() {
    const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
    if (!url) {
        logger.warn('🔴 REDIS_URL or UPSTASH_REDIS_REST_URL is not defined. Redis-dependent features will fail.');
        return undefined;
    }
    return {
        host: new URL(url).hostname,
        port: Number(new URL(url).port),
        password: new URL(url).password,
        tls: url.startsWith('rediss://') ? {} : undefined,
    };
}
// Initializes a shared ioredis client.
async function initializeRedis() {
    if (redisInitializationPromise) {
        return redisInitializationPromise;
    }
    redisInitializationPromise = (async () => {
        if (redis && redis.status === 'ready') {
            logger.info('Redis client already initialized and ready.');
            return true;
        }
        logger.info('🚀 Starting shared Redis client initialization...');
        const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
        if (!url) {
            logger.error('🔴 Cannot initialize Redis, no URL found.');
            return false;
        }
        try {
            logger.info(`Attempting to connect to Redis at ${new URL(url).hostname}...`);
            const options = {
                maxRetriesPerRequest: 3,
                connectTimeout: 10000,
                lazyConnect: true,
            };
            exports.redis = redis = new ioredis_1.default(url, options);
            redis.on('connect', () => logger.info('✅ Shared Redis client connected.'));
            redis.on('ready', () => logger.info('✅ Shared Redis client ready.'));
            redis.on('error', (err) => logger.error('🔴 Shared Redis client error', { error: err.message }));
            await redis.connect();
            const ping = await redis.ping();
            if (ping === 'PONG') {
                logger.info('✅ Redis connection verified with PING.');
                return true;
            }
            else {
                throw new Error('Redis PING command failed.');
            }
        }
        catch (error) {
            logger.error('🔴 Shared Redis client initialization failed.', { error: error instanceof Error ? error.message : String(error) });
            if (redis) {
                redis.disconnect();
            }
            exports.redis = redis = null;
            return false;
        }
    })();
    return redisInitializationPromise;
}
