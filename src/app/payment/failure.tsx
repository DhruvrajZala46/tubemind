"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentFailure() {
  const router = useRouter();
  
  // Auto-redirect after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard/new');
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0D1117] via-[#161B22] to-[#1A1F26] text-white px-4">
      <div className="max-w-lg w-full bg-[#161B22] rounded-2xl shadow-2xl p-10 flex flex-col items-center animate-fade-in">
        <span className="text-6xl mb-4">❌</span>
        <h1 className="text-3xl font-bold mb-2 text-center">Payment Failed</h1>
        <p className="text-lg text-[#8B949E] mb-6 text-center">
          We couldn't process your payment. No charges were made to your account.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="/dashboard/new">
            <button className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg text-lg transition-colors shadow-lg">
              Return to Dashboard
            </button>
          </a>
          <a href="/">
            <button className="bg-[#00D4AA] hover:bg-[#00b894] text-white font-semibold px-6 py-3 rounded-lg text-lg transition-colors shadow-lg">
              Try Again
            </button>
          </a>
        </div>
        <p className="text-sm text-[#8B949E] mt-6">
          Redirecting you to dashboard in 10 seconds...
        </p>
      </div>
    </div>
  );
} 