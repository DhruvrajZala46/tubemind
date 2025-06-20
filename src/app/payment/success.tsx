"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentSuccess() {
  const router = useRouter();
  
  // Auto-redirect after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard/new');
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0D1117] via-[#161B22] to-[#1A1F26] text-white px-4">
      <div className="max-w-lg w-full bg-[#161B22] rounded-2xl shadow-2xl p-10 flex flex-col items-center animate-fade-in">
        <span className="text-6xl mb-4 animate-pulse">🎉</span>
        <h1 className="text-3xl font-bold mb-2 text-center">Payment Successful!</h1>
        <p className="text-lg text-[#8B949E] mb-6 text-center">
          Thank you for your purchase. Your credits and plan have been upgraded.<br />
          Enjoy your new features!
        </p>
        <a href="/dashboard/new">
          <button className="bg-[#00D4AA] hover:bg-[#00b894] text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors shadow-lg animate-bounce">
            Go to Dashboard
          </button>
        </a>
        <p className="text-sm text-[#8B949E] mt-4">
          Redirecting you automatically in 5 seconds...
        </p>
      </div>
    </div>
  );
} 