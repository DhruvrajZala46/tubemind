// 🏥 HEALTH CHECK ENDPOINT - Production Monitoring
// This endpoint checks all critical services and dependencies

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../lib/logger';
import { monitoring } from '../../../lib/monitoring';

const logger = createLogger('health-check');

// The DB connection is now initialized on-demand within the checkDatabase function.
// This prevents the connection from being attempted during the build process.
let sql: any = null;

function getDbConnection() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set for health check.');
    }
    sql = neon(process.env.DATABASE_URL);
    logger.info('Health check database connection initialized.');
  }
  return sql;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('🏥 Health check initiated');

    // Check all services in parallel
    const [databaseHealth, openaiHealth, authHealth] = await Promise.allSettled([
      checkDatabase(),
      checkOpenAI(), 
      checkAuth()
    ]);

    const services = {
      database: getServiceResult(databaseHealth),
      openai: getServiceResult(openaiHealth),
      auth: getServiceResult(authHealth),
      monitoring: checkMonitoring()
    };

    const overallStatus = determineOverallStatus(services);
    const responseTime = Date.now() - startTime;
    const systemHealth = monitoring.getSystemHealth();

    const healthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime,
      uptime: systemHealth.uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      metrics: {
        memory: systemHealth.memory,
        activeAlerts: systemHealth.activeAlerts,
        criticalAlerts: systemHealth.criticalAlerts,
        recentErrors: systemHealth.recentErrors
      }
    };

    logger.info(`🏥 Health check completed in ${responseTime}ms - Status: ${overallStatus}`);

    const httpStatus = overallStatus === 'healthy' ? 200 : 
                     overallStatus === 'degraded' ? 206 : 503;

    return NextResponse.json(healthStatus, { status: httpStatus });

  } catch (error: any) {
    logger.error('Health check failed', { data: { error: error.message } });
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure'
    }, { status: 503 });
  }
}

// Service Health Checks
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const db = getDbConnection();
    await db`SELECT 1 as test`;
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
      error: error.message
    };
  }
}

async function checkOpenAI(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    if (!hasApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
      error: error.message
    };
  }
}

async function checkAuth(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const hasClerkKeys = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
    if (!hasClerkKeys) {
      throw new Error('Clerk authentication keys not configured');
    }
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
      error: error.message
    };
  }
}

function checkMonitoring(): ServiceHealth {
  const start = Date.now();
  try {
    const health = monitoring.getSystemHealth();
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
      error: error.message
    };
  }
}

// Utility Functions
function getServiceResult(settledResult: PromiseSettledResult<ServiceHealth>): ServiceHealth {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value;
  } else {
    return {
      status: 'unhealthy',
      responseTime: 0,
      lastChecked: new Date().toISOString(),
      error: settledResult.reason?.message || 'Service check failed'
    };
  }
}

function determineOverallStatus(services: { [key: string]: ServiceHealth }): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(services).map(s => s.status);
  
  if (statuses.every(status => status === 'healthy')) {
    return 'healthy';
  }
  
  if (statuses.some(status => status === 'unhealthy')) {
    return 'unhealthy';
  }
  
  return 'degraded';
} 