import { NextRequest, NextResponse } from 'next/server';
import { getLoadBalancerStats } from '../../../../lib/load-balancer';
import { secureMonitoringEndpoint } from '../../../../lib/auth-utils';

export async function GET(request: NextRequest) {
  return secureMonitoringEndpoint(request, async () => {
    try {
      const stats = getLoadBalancerStats();
      
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        loadBalancer: stats,
        status: 'operational',
        summary: {
          totalServices: Object.keys(stats).length,
          healthyServices: Object.values(stats).filter((service: any) => 
            service.totalInstances > 0
          ).length
        }
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Failed to get load balancer stats', details: error.message },
        { status: 500 }
      );
    }
  });
} 