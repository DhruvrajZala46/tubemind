"use client";
import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { ElegantLoader } from "../../ui/elegant-loader";
import { PlanTextSkeleton } from '../../ui/skeleton';
import styles from './MainContent.module.css';

export default function MainHeader() {
  const { isLoaded } = useUser();
  const [planInfo, setPlanInfo] = useState<{ plan: string; status: string } | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);

  useEffect(() => {
    async function fetchPlan() {
      if (!isLoaded) return;
      
      setIsLoadingPlan(true);
      try {
        const res = await fetch('/api/usage');
        if (res.ok) {
          const data = await res.json();
          setPlanInfo({ plan: data.plan, status: data.status });
        }
      } catch (error) {
        console.error('Error fetching plan:', error);
        // Set fallback plan info on error
        setPlanInfo({ plan: 'free', status: 'active' });
      } finally {
        setIsLoadingPlan(false);
      }
    }
    
    fetchPlan();
  }, [isLoaded]);

  if (!isLoaded) {
    return <div className="flex items-center justify-center w-full py-10"><ElegantLoader size="md" /></div>;
  }

  return (
    <div className="flex flex-col items-center justify-center text-center w-full">
      {/* Mobile Layout - Logo above text with plan badge below logo */}
      <div className="sm:hidden flex flex-col items-center justify-center mb-6">
        <a href="/" className="inline-block mb-6">
          <img 
            src="/logo.svg" 
            alt="TubeMind Logo" 
            className={`w-28 h-28 ${styles.mobileLogo}`}
          />
        </a>
        
        {/* Plan Badge - Now below logo */}
        <div className="mb-6">
          {isLoadingPlan ? (
            <PlanTextSkeleton />
          ) : (
            <div className="inline-flex items-center text-sm">
              <span className={`font-medium capitalize ${
                planInfo?.plan === 'pro' ? 'text-[#FFD700]' : 
                planInfo?.plan === 'basic' ? 'text-[#32D74B]' : 
                'text-[#DC143C]'
              }`}>
                {planInfo?.plan || 'Free'} plan
              </span>
              <span className="mx-1.5 text-[#8B949E]">•</span>
              {planInfo?.plan === 'free' ? (
                <a href="/#pricing" className="text-[#58A6FF] hover:text-[#58A6FF]/80 font-medium underline">
                  Upgrade
                </a>
              ) : (
                <a href="/api/subscription/manage" target="_blank" className="text-[#58A6FF] hover:text-[#58A6FF]/80 font-medium underline">
                  Manage
                </a>
              )}
            </div>
          )}
        </div>
        
        <h1 className="text-[2.2rem] font-medium leading-tight text-[#F0F6FC] tracking-[-0.01em]" style={{ fontFamily: 'system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif' }}>
          Watch Less, Learn More
        </h1>
      </div>

      {/* Desktop Layout - Original side-by-side with smaller gap and bigger logo */}
      <div className="hidden sm:block">
        <div className="inline-flex items-center text-xs sm:text-sm mb-4 sm:mb-6">
          {isLoadingPlan ? (
            <PlanTextSkeleton />
          ) : (
            <>
              <span className={`font-medium capitalize ${
                planInfo?.plan === 'pro' ? 'text-[#FFD700]' : 
                planInfo?.plan === 'basic' ? 'text-[#32D74B]' : 
                'text-[#FF0033]'
              }`}>
                {planInfo?.plan || 'Free'} plan
              </span>
              <span className="mx-1.5 text-[#8B949E]">•</span>
              {planInfo?.plan === 'free' ? (
                <a href="/#pricing" className="text-[#58A6FF] hover:text-[#58A6FF]/80 font-medium underline">
                  Upgrade
                </a>
              ) : (
                <a href="/api/subscription/manage" target="_blank" className="text-[#58A6FF] hover:text-[#58A6FF]/80 font-medium underline">
                  Manage
                </a>
              )}
            </>
          )}
        </div>
        
        <h1 className="text-[2.2rem] sm:text-[2.6rem] md:text-[2.8rem] lg:text-[3rem] font-medium leading-tight text-[#F0F6FC] mb-6 sm:mb-8 tracking-[-0.01em] flex items-center justify-center" style={{ fontFamily: 'system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif' }}>
          <a href="/" className="inline-block mr-2 align-middle">
            <img src="/logo.svg" alt="TubeMind Logo" className={`${styles.asteriskIcon} w-16 h-16 inline-block animate-spin-slow`} style={{ verticalAlign: 'middle' }} />
          </a>
          <span className="font-medium align-middle">Watch Less, Learn More</span>
        </h1>
      </div>
    </div>
  );
} 
 