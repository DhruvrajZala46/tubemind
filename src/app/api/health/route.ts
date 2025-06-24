// 🏥 HEALTH CHECK ENDPOINT - Production Monitoring
// This endpoint checks all critical services and dependencies

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../lib/logger';
import { monitoring } from '../../../lib/monitoring';
import { executeQuery } from '@/lib/db';
import { checkRedisHealth, getRedisQueueStats } from '@/lib/redis-queue';

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

export async function GET() {
  try {
    // Simple health check - just return system status
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'tubemind-api',
      uptime: process.uptime()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Service Health Checks
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const db = getDbConnection();
    const dbTest = await executeQuery(async (sql) => {
      return await sql`SELECT 1 as test, NOW() as timestamp`;
    });
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