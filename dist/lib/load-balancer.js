"use strict";
// 🚀 PHASE 5.3: LOAD BALANCING STRATEGY
// Distributes traffic across multiple service instances to prevent failures
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBalancer = exports.LoadBalancer = void 0;
exports.executeWithLoadBalancer = executeWithLoadBalancer;
exports.getLoadBalancerStats = getLoadBalancerStats;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('load-balancer');
class LoadBalancer {
    constructor() {
        this.instances = new Map();
        this.setupDefaultServices();
        logger.info('🚀 Load balancer initialized');
    }
    registerService(serviceName, urls) {
        this.instances.set(serviceName, urls);
        logger.info(`📋 Registered ${urls.length} instances for service: ${serviceName}`);
    }
    getServiceUrl(serviceName) {
        const urls = this.instances.get(serviceName);
        if (!urls || urls.length === 0)
            return null;
        // Simple round-robin
        const url = urls[0];
        urls.push(urls.shift()); // Move first to end
        return url;
    }
    async executeWithRetry(serviceName, requestFn, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const url = this.getServiceUrl(serviceName);
            if (!url) {
                throw new Error(`No available instances for service: ${serviceName}`);
            }
            try {
                const result = await requestFn(url);
                return result;
            }
            catch (error) {
                lastError = error;
                logger.warn(`Attempt ${attempt + 1} failed for ${serviceName}: ${error.message}`);
                if (attempt === maxRetries - 1) {
                    throw lastError;
                }
                // Simple delay between retries
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
        throw lastError;
    }
    getServiceStats(serviceName) {
        const urls = this.instances.get(serviceName) || [];
        return {
            serviceName,
            totalInstances: urls.length,
            instances: urls.map(url => ({ url, status: 'active' }))
        };
    }
    setupDefaultServices() {
        // Transcript microservice
        this.registerService('transcript', [
            process.env.TRANSCRIPT_SERVICE_URL || 'https://your-transcript-service.railway.app'
        ]);
        // OpenAI service
        this.registerService('openai', [
            'https://api.openai.com/v1'
        ]);
        // YouTube API
        this.registerService('youtube', [
            'https://www.googleapis.com/youtube/v3'
        ]);
    }
}
exports.LoadBalancer = LoadBalancer;
exports.loadBalancer = new LoadBalancer();
async function executeWithLoadBalancer(serviceName, requestFn) {
    return exports.loadBalancer.executeWithRetry(serviceName, requestFn);
}
function getLoadBalancerStats() {
    return {
        transcript: exports.loadBalancer.getServiceStats('transcript'),
        openai: exports.loadBalancer.getServiceStats('openai'),
        youtube: exports.loadBalancer.getServiceStats('youtube')
    };
}
