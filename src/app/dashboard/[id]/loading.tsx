import React from 'react';
import { ElegantLoader } from "../../../components/ui/elegant-loader";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0D1117] text-white flex items-center justify-center">
      <ElegantLoader size="lg" />
    </main>
  );
}
