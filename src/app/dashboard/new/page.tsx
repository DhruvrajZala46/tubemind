import React from 'react';
import MainContent from '../../../components/Dashboard/MainContent';
import { Suspense } from 'react';
import { ElegantLoader } from "../../../components/ui/elegant-loader";

export default function DashboardNewPage() {
  return (
    <Suspense fallback={<div className='flex items-center justify-center min-h-screen px-4'><ElegantLoader size="lg" /></div>}>
      <div className="w-full min-h-screen">
        <MainContent />
      </div>
    </Suspense>
  );
} 