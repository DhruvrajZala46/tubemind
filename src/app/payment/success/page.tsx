'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAnimated, setIsAnimated] = useState(false);
  
  const planName = searchParams.get('plan') || 'Premium';
  const amount = searchParams.get('amount') || '';
  
  useEffect(() => {
    // Trigger celebration animation after component mounts
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Success Animation */}
        <div className={`text-center transition-all duration-1000 ${isAnimated ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <div className="relative inline-flex items-center justify-center">
            <CheckCircleIcon className="h-24 w-24 text-green-500 animate-bounce" />
            <div className="absolute -top-2 -right-2">
              <SparklesIcon className="h-8 w-8 text-yellow-400 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Success Message */}
        <Card className={`shadow-2xl border-0 transition-all duration-1000 delay-300 ${isAnimated ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900">
              🎉 Payment Successful!
            </CardTitle>
            <CardDescription className="text-gray-600">
              Welcome to {planName} Plan
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-gray-800">
                You're all set to unlock powerful video insights!
              </p>
              {amount && (
                <p className="text-sm text-gray-600">
                  Subscription: ${amount}
                </p>
              )}
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-gray-800">What's next?</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✨ Your credits have been added to your account</li>
                <li>🚀 Start processing videos with AI-powered insights</li>
                <li>📊 Access detailed analytics and summaries</li>
                <li>💫 Enjoy your enhanced experience</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => router.push('/dashboard/new')}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                Start Processing Videos 🎬
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard/new')}
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className={`text-center transition-all duration-1000 delay-500 ${isAnimated ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-sm text-gray-500">
            Questions? Contact our support team anytime.
          </p>
        </div>
      </div>
    </div>
  );
} 