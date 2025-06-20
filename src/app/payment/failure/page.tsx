'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { XCircleIcon, ArrowPathIcon, CreditCardIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentFailurePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAnimated, setIsAnimated] = useState(false);
  
  const error = searchParams.get('error') || 'Payment could not be processed';
  const planName = searchParams.get('plan') || '';
  
  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const commonIssues = [
    { issue: 'Insufficient funds', solution: 'Check your account balance' },
    { issue: 'Card declined', solution: 'Try a different payment method' },
    { issue: 'Network timeout', solution: 'Check your internet connection' },
    { issue: 'Invalid card details', solution: 'Verify your card information' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Error Icon */}
        <div className={`text-center transition-all duration-1000 ${isAnimated ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <XCircleIcon className="h-24 w-24 text-red-500 mx-auto animate-pulse" />
        </div>

        {/* Error Message */}
        <Card className={`shadow-2xl border-0 transition-all duration-1000 delay-300 ${isAnimated ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Payment Failed
            </CardTitle>
            <CardDescription className="text-gray-600">
              {planName && `We couldn't process your ${planName} subscription`}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">
                {error}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Common Issues & Solutions:</h3>
              <div className="space-y-2">
                {commonIssues.map((item, index) => (
                  <div key={index} className="flex items-start space-x-3 text-sm">
                    <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <span className="font-medium text-gray-700">{item.issue}:</span>
                      <span className="text-gray-600 ml-1">{item.solution}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => router.push('/pricing')}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <ArrowPathIcon className="h-5 w-5" />
                <span>Try Again</span>
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center space-x-2"
              >
                <CreditCardIcon className="h-5 w-5" />
                <span>Continue with Free Plan</span>
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Need Help?</h4>
              <p className="text-sm text-blue-700">
                Contact our support team if you continue experiencing issues. 
                We're here to help you get started with your subscription.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className={`text-center transition-all duration-1000 delay-500 ${isAnimated ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-sm text-gray-500">
            All payment attempts are secure and encrypted.
          </p>
        </div>
      </div>
    </div>
  );
} 