'use client';

import { SignIn } from "@clerk/nextjs";
import { Suspense, useEffect } from 'react';
import { ElegantLoader } from '../../../components/ui/elegant-loader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  // 🔧 FIX: Clean up redirect loops on client side
  useEffect(() => {
    // If URL is too long (indicating redirect loop), clean it up
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      if (url.length > 2000 || url.includes('redirect_url=https%3A%2F%2F')) {
        console.log('🔄 Client-side redirect loop detected, cleaning URL');
        // Clean the URL by removing all query parameters
        const cleanUrl = window.location.origin + '/sign-in';
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, []);

  return (
    <Suspense fallback={<div className='flex items-center justify-center min-h-screen'><ElegantLoader size="lg" /></div>}>
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="w-full max-w-md">
          <SignIn />
          
          {/* Toggle for new users */}
          <div className="mt-6 text-center">
            <p className="text-[var(--text-secondary)] text-sm">
              Don't have an account?{' '}
              <Link 
                href="/sign-up" 
                className="text-[var(--btn-primary-bg)] hover:text-[var(--btn-primary-bg)]/80 font-medium transition-colors"
              >
                Sign up instead
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Suspense>
  );
} 