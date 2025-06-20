// 📊 MONITORING DASHBOARD API
// Endpoint for viewing system metrics, alerts, and performance data

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createLogger } from '../../../lib/logger';
import { monitoring, metrics } from '../../../lib/monitoring';

const logger = createLogger('monitoring-api');

export async function GET(request: NextRequest) {
  try {
    // Authentication check - only allow admins or development
    const { userId } = await auth();
    
    if (process.env.NODE_ENV === 'production' && !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '1h'; // 1h, 24h, 7d
    const type = searchParams.get('type') || 'all'; // metrics, alerts, performance, all

    const since = getSinceTimestamp(timeRange);

    let response: any = {
      timestamp: new Date().toISOString(),
      timeRange,
      systemHealth: monitoring.getSystemHealth()
    };

    // Get different types of monitoring data based on request
    switch (type) {
      case 'metrics':
        response.metrics = monitoring.getMetrics(undefined, since);
        break;
      
      case 'alerts':
        response.alerts = {
          all: monitoring.getAlerts(),
          unresolved: monitoring.getAlerts(undefined, false),
          critical: monitoring.getAlerts('critical', false),
          summary: getAlertsSummary()
        };
        break;
      
      case 'performance':
        response.performance = {
          overall: monitoring.getPerformanceStats(undefined, since),
          apiRequests: monitoring.getPerformanceStats('api_request', since),
          dbQueries: monitoring.getPerformanceStats('db_query', since),
          videoProcessing: monitoring.getPerformanceStats('video_processing', since)
        };
        break;
      
      default: // 'all'
        response = {
          ...response,
          metrics: {
            recent: monitoring.getMetrics(undefined, since).slice(-50), // Last 50 metrics
            summary: getMetricsSummary(since)
          },
          alerts: {
            recent: monitoring.getAlerts().slice(-20), // Last 20 alerts
            unresolved: monitoring.getAlerts(undefined, false),
            critical: monitoring.getAlerts('critical', false)
          },
          performance: {
            overall: monitoring.getPerformanceStats(undefined, since),
            apiRequests: monitoring.getPerformanceStats('api_request', since),
            dbQueries: monitoring.getPerformanceStats('db_query', since)
          }
        };
    }

    logger.info(`📊 Monitoring data retrieved for ${timeRange} range`, { 
      data: { type, userId, dataPoints: Object.keys(response).length } 
    });

    return NextResponse.json(response);

  } catch (error: any) {
    logger.error('Failed to retrieve monitoring data', { 
      data: { error: error.message } 
    });

    return NextResponse.json(
      { error: 'Failed to retrieve monitoring data' },
      { status: 500 }
    );
  }
}

// POST endpoint for triggering alerts or recording custom metrics
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'triggerAlert':
        const alertId = monitoring.triggerAlert(
          data.severity || 'medium',
          data.message,
          data.service || 'manual',
          data.metadata
        );
        
        logger.info('🚨 Manual alert triggered', { 
          data: { alertId, userId, ...data } 
        });
        
        return NextResponse.json({ success: true, alertId });

      case 'recordMetric':
        monitoring.incrementCounter(
          data.name,
          data.value || 1,
          data.tags
        );
        
        logger.info('📊 Custom metric recorded', { 
          data: { metric: data.name, value: data.value, userId } 
        });
        
        return NextResponse.json({ success: true });

      case 'resolveAlert':
        monitoring.resolveAlert(data.alertId);
        
        logger.info('✅ Alert resolved manually', { 
          data: { alertId: data.alertId, userId } 
        });
        
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    logger.error('Failed to process monitoring action', { 
      data: { error: error.message } 
    });

    return NextResponse.json(
      { error: 'Failed to process monitoring action' },
      { status: 500 }
    );
  }
}

// Utility functions
function getSinceTimestamp(timeRange: string): number {
  const now = Date.now();
  
  switch (timeRange) {
    case '1h':
      return now - (60 * 60 * 1000);
    case '24h':
      return now - (24 * 60 * 60 * 1000);
    case '7d':
      return now - (7 * 24 * 60 * 60 * 1000);
    default:
      return now - (60 * 60 * 1000); // Default to 1 hour
  }
}

function getAlertsSummary() {
  const allAlerts = monitoring.getAlerts();
  const last24h = allAlerts.filter(a => a.timestamp > Date.now() - 24 * 60 * 60 * 1000);
  
  return {
    total: allAlerts.length,
    last24h: last24h.length,
    critical: allAlerts.filter(a => a.severity === 'critical').length,
    unresolved: allAlerts.filter(a => !a.resolved).length,
    resolvedToday: last24h.filter(a => a.resolved).length
  };
}

function getMetricsSummary(since: number) {
  const allMetrics = monitoring.getMetrics(undefined, since);
  
  const metricsByType = allMetrics.reduce((acc, metric) => {
    if (!acc[metric.name]) {
      acc[metric.name] = [];
    }
    acc[metric.name].push(metric);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    totalMetrics: allMetrics.length,
    metricTypes: Object.keys(metricsByType).length,
    mostActive: Object.entries(metricsByType)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 5)
      .map(([name, metrics]) => ({
        name,
        count: metrics.length,
        lastValue: metrics[metrics.length - 1]?.value || 0
      }))
  };
} 