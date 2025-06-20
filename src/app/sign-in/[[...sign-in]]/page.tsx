import { SignIn } from "@clerk/nextjs";
import { Suspense } from 'react';
import { ElegantLoader } from '../../../components/ui/elegant-loader';

export default function Page() {
  return (
    <Suspense fallback={<div className='flex items-center justify-center min-h-screen'><ElegantLoader size="lg" /></div>}>
      <div className="flex items-center justify-center h-screen">
        <SignIn afterSignInUrl="/dashboard/new" afterSignUpUrl="/dashboard/new" />
      </div>
    </Suspense>
  );
} 