"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueJob = enqueueJob;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('cloud-tasks-queue');
// Check if we're in a Node.js environment (server-side)
const isServerSide = typeof globalThis !== 'undefined' && typeof globalThis.process !== 'undefined';
async function enqueueJob(jobData) {
    // Only run on server-side (Cloud Run worker or API routes)
    if (!isServerSide) {
        throw new Error('Cloud Tasks can only be used on the server side');
    }
    try {
        // Dynamically import Cloud Tasks client only on server-side
        const { CloudTasksClient } = await Promise.resolve().then(() => __importStar(require('@google-cloud/tasks')));
        const client = new CloudTasksClient();
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT;
        const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
        const queueName = process.env.CLOUD_TASKS_QUEUE_NAME || 'video-processing-queue';
        const workerUrl = process.env.WORKER_SERVICE_URL;
        if (!projectId) {
            throw new Error('GOOGLE_CLOUD_PROJECT_ID or GCP_PROJECT environment variable is required');
        }
        if (!workerUrl) {
            throw new Error('WORKER_SERVICE_URL environment variable is required');
        }
        // Construct the parent path
        const parent = client.queuePath(projectId, location, queueName);
        // Construct the task
        const task = {
            httpRequest: {
                httpMethod: 'POST',
                url: workerUrl,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: Buffer.from(JSON.stringify(jobData)),
            },
        };
        logger.info('Enqueueing job to Cloud Tasks', {
            parent,
            workerUrl,
            videoId: jobData.videoId,
            userId: jobData.userId
        });
        // Send create task request
        const [response] = await client.createTask({ parent, task });
        const taskName = response.name || 'unknown';
        logger.info('Job enqueued successfully', {
            taskName,
            videoId: jobData.videoId
        });
        return taskName;
    }
    catch (error) {
        logger.error('Failed to enqueue job', {
            error: error instanceof Error ? error.message : String(error),
            jobData,
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}
