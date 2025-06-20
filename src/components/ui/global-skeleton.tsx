import React from 'react';
import { cn } from '../../lib/utils';

export function GlobalSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-48 bg-gray-700 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-gray-700 rounded-lg animate-pulse"></div>
        </div>

        {/* Main content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="h-12 w-full bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="h-64 w-full bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 w-full bg-gray-700 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="h-32 w-full bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 w-full bg-gray-700 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center space-x-2 text-gray-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading your content...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse"></div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="h-6 w-48 bg-gray-700 rounded mb-4 animate-pulse"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gray-700 rounded animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-700 rounded animate-pulse"></div>
                <div className="h-3 bg-gray-700 rounded w-3/4 animate-pulse"></div>
              </div>
              <div className="h-8 w-20 bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 