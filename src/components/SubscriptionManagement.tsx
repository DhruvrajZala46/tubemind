import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface SubscriptionData {
  tier: string;
  status: string;
  creditsUsed: number;
  creditsLimit: number;
  remainingCredits: number;
  usagePercentage: number;
}

export default function SubscriptionManagement() {
  const { user } = useUser();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/status');
      const data = await response.json();
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/manage');
      const data = await response.json();
      
      if (data.success && data.manageUrl) {
        // Open Polar customer portal in new tab
        window.open(data.manageUrl, '_blank');
      } else {
        alert('Please contact support to manage your subscription.');
      }
    } catch (error) {
      console.error('Error opening subscription management:', error);
      alert('Error opening subscription management. Please contact support.');
    }
  };

  if (loading) {
    return <div className="p-4">Loading subscription details...</div>;
  }

  if (!subscription) {
    return <div className="p-4">Unable to load subscription details.</div>;
  }

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 max-w-md mx-auto">
      <h3 className="text-xl font-bold text-[#F0F6FC] mb-4">Subscription Management</h3>
      
      {/* Current Plan */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#8B949E]">Current Plan:</span>
          <span className="text-[#F0F6FC] font-semibold capitalize">
            {subscription.tier}
            {subscription.tier === 'basic' && ' ($9/month)'}
            {subscription.tier === 'pro' && ' ($15/month)'}
            {subscription.tier === 'free' && ' (Free)'}
          </span>
        </div>
        
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#8B949E]">Status:</span>
          <span className={`font-semibold capitalize ${
            subscription.status === 'active' ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {subscription.status}
          </span>
        </div>
      </div>

      {/* Credit Usage */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#8B949E]">Credits Used:</span>
          <span className="text-[#F0F6FC]">
            {subscription.creditsUsed}/{subscription.creditsLimit}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-[#21262D] rounded-full h-2.5 mb-2">
          <div 
            className="bg-[#FF0033] h-2.5 rounded-full" 
            style={{ width: `${Math.min(subscription.usagePercentage, 100)}%` }}
          ></div>
        </div>
        
        <div className="text-[#8B949E] text-sm">
          {subscription.remainingCredits} credits remaining this month
        </div>
      </div>

      {/* Management Actions */}
      {subscription.tier !== 'free' ? (
        <div className="space-y-3">
          <button
            onClick={handleManageSubscription}
            className="w-full bg-[#FF0033] hover:bg-[#FF0033]/90 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            🔧 Manage Subscription
          </button>
          
          <div className="text-[#8B949E] text-sm">
            Click above to:
            <ul className="list-disc list-inside mt-1 ml-2">
              <li>Cancel subscription</li>
              <li>Update payment method</li>
              <li>View billing history</li>
              <li>Download invoices</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-[#8B949E] mb-3">You're on the free plan</p>
          <button
            onClick={() => window.location.href = '/#pricing'}
            className="bg-[#FF0033] hover:bg-[#FF0033]/90 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {/* Contact Support */}
      <div className="mt-4 pt-4 border-t border-[#30363D]">
        <p className="text-[#8B949E] text-sm text-center">
          Need help? <a href="mailto:support@tubegpt.com" className="text-[#FF0033] hover:underline">Contact Support</a>
        </p>
      </div>
    </div>
  );
} 