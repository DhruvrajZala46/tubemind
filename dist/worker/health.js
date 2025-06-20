"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHealthCheckServer = startHealthCheckServer;
exports.stopHealthCheckServer = stopHealthCheckServer;
const http_1 = __importDefault(require("http"));
const os_1 = __importDefault(require("os"));
// Global variables to track server state
let healthServer = null;
let isStarting = false;
let serverPort = null;
let serverStartAttempts = 0;
const MAX_START_ATTEMPTS = 10;
/**
 * Start the health check server for monitoring the worker process
 * This function is designed to be idempotent - calling it multiple times is safe
 */
function startHealthCheckServer() {
    // If server is already running or starting, don't start another one
    if (healthServer) {
        console.log('🏥 Health check server already running on port', serverPort);
        return;
    }
    if (isStarting) {
        console.log('🏥 Health check server is already starting...');
        return;
    }
    // Reset server start attempts
    serverStartAttempts = 0;
    isStarting = true;
    // Use the standard PORT variable provided by platforms like Leapcell/Vercel first.
    // Fallback to WORKER_PORT and then to a default for local development.
    const defaultPort = 8002;
    const PORT = parseInt(process.env.PORT || process.env.WORKER_PORT || '') || defaultPort;
    try {
        // Create a new server instance
        const server = http_1.default.createServer((req, res) => {
            if (req.url === '/kaithheathcheck' || req.url === '/health') {
                // Get system information
                const memoryUsage = process.memoryUsage();
                const systemInfo = {
                    memoryUsage: {
                        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                    },
                    uptime: `${Math.round(process.uptime())} seconds`,
                    platform: process.platform,
                    nodeVersion: process.version,
                    cpuCores: os_1.default.cpus().length,
                    hostname: os_1.default.hostname(),
                };
                // Check Redis connection status
                const redisStatus = {
                    redisUrl: process.env.REDIS_URL ? 'configured' : 'not configured',
                    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL ? 'configured' : 'not configured',
                    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ? 'configured' : 'not configured',
                    redisDisabled: process.env.DISABLE_REDIS === 'true' ? 'true' : 'false',
                };
                // Environment information
                const envInfo = {
                    nodeEnv: process.env.NODE_ENV || 'not set',
                    isLeapcell: process.env.LEAPCELL === 'true' || process.env.DEPLOYMENT_ENV === 'leapcell',
                    port: process.env.PORT || 'not set',
                    workerPort: process.env.WORKER_PORT || 'not set',
                    finalPort: serverPort || 'not set'
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'healthy',
                    service: 'tubegpt-worker',
                    timestamp: new Date().toISOString(),
                    system: systemInfo,
                    redis: redisStatus,
                    environment: envInfo,
                    version: '1.0.0'
                }, null, 2));
            }
            else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        // Set up error handler before attempting to listen
        server.on('error', (e) => {
            if (e.code === 'EADDRINUSE' && serverStartAttempts < MAX_START_ATTEMPTS) {
                serverStartAttempts++;
                console.warn(`⚠️ Port ${PORT + serverStartAttempts - 1} is in use, trying port ${PORT + serverStartAttempts}...`);
                // Try the next port
                tryStartServer(server, PORT + serverStartAttempts);
            }
            else if (e.code === 'ERR_SERVER_ALREADY_LISTEN') {
                console.warn(`⚠️ Server already listening. Ignoring duplicate start request.`);
                isStarting = false;
            }
            else {
                console.error(`❌ Failed to start health check server: ${e.message}`);
                isStarting = false;
                // Clean up server instance to allow future retry
                try {
                    server.close();
                }
                catch (closeError) {
                    // Ignore close errors
                }
            }
        });
        // Try to start server on the specified port
        tryStartServer(server, PORT);
    }
    catch (error) {
        console.error(`❌ Error creating health check server: ${error}`);
        isStarting = false;
    }
}
/**
 * Try to start server on different ports if there's a conflict
 */
function tryStartServer(server, port) {
    try {
        // Try to listen on the port
        server.listen(port, () => {
            healthServer = server;
            serverPort = port;
            isStarting = false;
            console.log(`🏥 Health check server running on port ${port}`);
            // Save the port to environment variable for other processes to use
            process.env.HEALTH_CHECK_PORT = port.toString();
        });
    }
    catch (error) {
        console.error(`❌ Error in tryStartServer: ${error}`);
        isStarting = false;
    }
}
/**
 * Stop the health check server gracefully
 */
function stopHealthCheckServer() {
    return new Promise((resolve) => {
        if (!healthServer) {
            resolve();
            return;
        }
        const server = healthServer;
        healthServer = null;
        serverPort = null;
        isStarting = false;
        server.close(() => {
            console.log('🏥 Health check server stopped');
            resolve();
        });
    });
}
// Handle process termination
process.on('SIGTERM', async () => {
    console.log('👋 Shutting down application...');
    await stopHealthCheckServer();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('👋 Shutting down application...');
    await stopHealthCheckServer();
    process.exit(0);
});
// Handle uncaught exceptions related to server
process.on('uncaughtException', (error) => {
    if (error.message.includes('ERR_SERVER_ALREADY_LISTEN')) {
        console.warn(`⚠️ Caught server already listening error. This is likely a duplicate server start attempt.`);
        // Don't crash the process for this specific error
    }
    else {
        // For other uncaught exceptions, log and let the process crash
        console.error('Uncaught Exception:', error);
        throw error;
    }
});
