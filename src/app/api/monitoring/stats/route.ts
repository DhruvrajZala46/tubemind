import { NextRequest, NextResponse } from 'next/server';
import { monitoring } from '../../../../lib/monitoring';
import { getCacheMetrics } from '../../../../lib/cache';
import { secureMonitoringEndpoint } from '../../../../lib/auth-utils';

export async function GET(request: NextRequest) {
  return secureMonitoringEndpoint(request, async () => {
    try {
      const systemHealth = monitoring.getSystemHealth();
      const cacheStats = getCacheMetrics();
      
      // Get performance stats for last hour
      const performanceStats = monitoring.getPerformanceStats();
      
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        system: systemHealth,
        cache: cacheStats,
        performance: performanceStats,
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Failed to get monitoring stats', details: error.message },
        { status: 500 }
      );
    }
  });
} 