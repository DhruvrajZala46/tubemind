// 🚀 PHASE 5.3: LOAD BALANCING STRATEGY
// Distributes traffic across multiple service instances to prevent failures

import { createLogger } from './logger';

const logger = createLogger('load-balancer');

export class LoadBalancer {
  private instances: Map<string, string[]> = new Map();

  constructor() {
    this.setupDefaultServices();
    logger.info('🚀 Load balancer initialized');
  }

  registerService(serviceName: string, urls: string[]): void {
    this.instances.set(serviceName, urls);
    logger.info(`📋 Registered ${urls.length} instances for service: ${serviceName}`);
  }

  getServiceUrl(serviceName: string): string | null {
    const urls = this.instances.get(serviceName);
    if (!urls || urls.length === 0) return null;
    
    // Simple round-robin
    const url = urls[0];
    urls.push(urls.shift()!); // Move first to end
    return url;
  }

  async executeWithRetry<T>(
    serviceName: string,
    requestFn: (url: string) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const url = this.getServiceUrl(serviceName);
      if (!url) {
        throw new Error(`No available instances for service: ${serviceName}`);
      }

      try {
        const result = await requestFn(url);
        return result;
      } catch (error: any) {
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

  getServiceStats(serviceName: string) {
    const urls = this.instances.get(serviceName) || [];
    return {
      serviceName,
      totalInstances: urls.length,
      instances: urls.map(url => ({ url, status: 'active' }))
    };
  }

  private setupDefaultServices(): void {
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

export const loadBalancer = new LoadBalancer();

export async function executeWithLoadBalancer<T>(
  serviceName: string,
  requestFn: (baseUrl: string) => Promise<T>
): Promise<T> {
  return loadBalancer.executeWithRetry(serviceName, requestFn);
}

export function getLoadBalancerStats() {
  return {
    transcript: loadBalancer.getServiceStats('transcript'),
    openai: loadBalancer.getServiceStats('openai'),
    youtube: loadBalancer.getServiceStats('youtube')
  };
} 