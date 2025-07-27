import { SignIn } from "@clerk/nextjs";
import { Suspense } from 'react';
import { ElegantLoader } from '../../../components/ui/elegant-loader';
import Link from 'next/link';

export default function Page() {
  return (
    <Suspense fallback={<div className='flex items-center justify-center min-h-screen'><ElegantLoader size="lg" /></div>}>
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="w-full max-w-md">
          <SignIn afterSignInUrl="/dashboard/new" afterSignUpUrl="/dashboard/new" />
          
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