'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CleanupPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear any problematic cookies
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      
      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clean the URL
      window.history.replaceState({}, '', '/');
      
      // Redirect to home page after cleanup
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">🧹 Cleaning up...</h1>
        <p className="text-[var(--text-secondary)]">Clearing browser state and redirecting...</p>
      </div>
    </div>
  );
} 