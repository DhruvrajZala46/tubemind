'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
// import { useRouter } from 'next/navigation';

interface SystemHealth {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  activeAlerts: number;
  criticalAlerts: number;
  recentErrors: number;
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  metrics: {
    memory: SystemHealth['memory'];
    activeAlerts: number;
    criticalAlerts: number;
  };
}

interface StatsData {
  system: SystemHealth;
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  performance: any;
  uptime: number;
}

export default function MonitoringDashboard() {
  const { isLoaded, userId } = useAuth();
  // const router = useRouter();
  const [data, setData] = useState<any>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !userId) {
      // router.push('/sign-in');
    }
  }, [isLoaded, userId]);

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Checking authentication...</div>
      </div>
    );
  }

  // Show sign-in required if not authenticated
  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">You must be signed in to access monitoring.</p>
          <button 
            // onClick={() => router.push('/sign-in')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">TubeMind Monitoring</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium">System Status</h3>
          <p className="text-green-600">Healthy</p>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ title, value, status }: { title: string; value: string; status: string }) {
  return (
    <div className={`rounded-lg border p-4 ${getStatusColor(status)}`}>
      <h3 className="font-medium text-sm opacity-75">{title}</h3>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
    case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'unhealthy': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
} 