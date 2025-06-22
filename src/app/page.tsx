'use client';

import { useState, Suspense } from 'react';
import { Youtube, ArrowUpRight, FileText, ListChecks, BookOpen, Download, Sun, Moon, XCircle, Search, Zap, LayoutGrid } from 'lucide-react';
import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ElegantLoader } from '../components/ui/elegant-loader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';

function Header({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleGetStarted = () => {
    if (isSignedIn) {
      router.push('/dashboard/new');
    } else {
      // Trigger Clerk signup modal
      const signUpButton = document.querySelector('[data-clerk-sign-up]') as HTMLButtonElement;
      signUpButton?.click();
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full z-30 bg-[#161B22]/95 backdrop-blur-md border-b border-[#30363D] shadow-lg">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        {/* Desktop: left logo, right menu; Mobile: centered logo, right hamburger */}
        <div className="flex flex-1 items-center justify-between w-full">
          {/* Logo/brand: left on desktop, centered on mobile */}
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-2">
            <Link href="/" className="flex items-center gap-1 group align-middle">
              <img src="/logo.svg" alt="TubeMind Logo" className="w-12 h-12 animate-spin-slow" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
              <span className="text-[#F0F6FC] font-semibold text-xl sm:text-2xl" style={{lineHeight:'1',verticalAlign:'middle'}}>TubeMind</span>
            </Link>
          </div>
          {/* Desktop menu and actions */}
          <div className="hidden lg:flex items-center gap-8 text-[#8B949E] font-medium ml-auto">
            <a href="#problem-with-youtube" className="hover:text-[#F0F6FC] transition cursor-pointer">Features</a>
            <a href="#pricing" className="hover:text-[#F0F6FC] transition cursor-pointer">Pricing</a>
            <a href="#about" className="hover:text-[#F0F6FC] transition cursor-pointer">About</a>
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-[#F0F6FC] bg-[#21262D] hover:bg-[#30363D] rounded-full transition font-medium cursor-pointer text-base pill-btn ml-4">
                  Sign in
                </button>
              </SignInButton>
            )}
            <button 
              onClick={handleGetStarted}
              className="px-5 py-2 bg-[#DC143C] hover:bg-[#DC143C]/90 text-white rounded-full transition font-semibold cursor-pointer text-base pill-btn shadow-md ml-2"
            >
              Get Started
            </button>
          </div>
          {/* Hamburger for mobile */}
          <div className="flex lg:hidden items-center gap-2 ml-auto">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 w-10 h-10 rounded-xl bg-[#23272F] hover:bg-[#30363D] text-[#F0F6FC] transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#DC143C]/20 flex items-center justify-center"
              aria-label="Open menu"
              style={{ boxShadow: '0 1px 6px 0 rgba(0,0,0,0.08)' }}
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><line x1="3" y1="7" x2="19" y2="7"/><line x1="3" y1="12" x2="19" y2="12"/><line x1="3" y1="17" x2="19" y2="17"/></svg>
            </button>
          </div>
        </div>
      </nav>
      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col sm:hidden">
          <div className="bg-[#161B22] border-b border-[#30363D] shadow-lg p-4 flex flex-col gap-4 animate-slide-in-left relative">
            <div className="flex items-center gap-1 justify-center mb-2">
              <Link href="/" className="flex items-center gap-1 group align-middle">
                <img src="/logo.svg" alt="TubeMind Logo" className="w-12 h-12 animate-spin-slow" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                <span className="text-[#F0F6FC] font-semibold text-xl" style={{lineHeight:'1',verticalAlign:'middle'}}>TubeMind</span>
              </Link>
            </div>
            <a href="#problem-with-youtube" className="block text-[#8B949E] hover:text-[#F0F6FC] text-base font-medium py-2 rounded-xl text-center transition">Features</a>
            <a href="#pricing" className="block text-[#8B949E] hover:text-[#F0F6FC] text-base font-medium py-2 rounded-xl text-center transition">Pricing</a>
            <a href="#about" className="block text-[#8B949E] hover:text-[#F0F6FC] text-base font-medium py-2 rounded-xl text-center transition">About</a>
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button className="w-full py-3 bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] rounded-full font-semibold text-base pill-btn mt-2">Sign in</button>
              </SignInButton>
            )}
            <button
              onClick={handleGetStarted}
              className="w-full py-3 bg-[#DC143C] hover:bg-[#DC143C]/90 text-white rounded-full font-semibold text-base pill-btn shadow-md mt-2"
            >
              Get Started
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-[#23272F] hover:bg-[#30363D] text-[#F0F6FC] focus:outline-none"
              aria-label="Close menu"
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function FeaturePills() {
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 mt-6 sm:mt-8 w-full max-w-2xl mx-auto px-2">
      {[
        { icon: FileText, text: "AI Summary" },
        { icon: ListChecks, text: "Key Points" },
        { icon: BookOpen, text: "Transcript" },
        { icon: Download, text: "Export Notes" }
      ].map(({ icon: Icon, text }) => (
        <button
          key={text}
          className="flex items-center gap-1.5 sm:gap-2 bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 font-medium text-xs sm:text-sm transition border border-[#30363D] cursor-pointer"
        >
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {text}
        </button>
      ))}
    </div>
  );
}

function CommunitySection() {
  return (
    <section className="w-full bg-[#161B22] border border-[#30363D] rounded-xl mt-16 mb-8 py-10 px-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#F0F6FC]">From the Community</h2>
        <Link href="#" className="text-[#DC143C] hover:text-[#DC143C]/90 font-medium flex items-center gap-1">
          View All <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="text-[#8B949E]">
        Discover how others are using TubeMind to transform their learning experience.
      </div>
    </section>
  );
}

function ProblemWithYouTube() {
  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-6 sm:gap-8 mb-8 sm:mb-12 px-4">
      <div className="flex-1 bg-[#161B22] rounded-xl p-4 sm:p-6 md:p-8 border border-[#30363D] shadow-lg">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#F0F6FC] mb-4 sm:mb-6">YouTube Is Packed with Value—But Here's the Catch</h2>
        <ul className="space-y-3 sm:space-y-4">
          {[
          { icon: XCircle, text: "So many videos, no time to watch and learn." },
          { icon: XCircle, text: "Life-changing content sits unwatched or forgotten." },
          { icon: XCircle, text: "Great videos appear mid-scroll—but no time or place to dive in." },
          { icon: XCircle, text: "'Watch Later' becomes guilt pile, not learning plan." },
          { icon: XCircle, text: "No fast way to absorb powerful content." },
          { icon: XCircle, text: "Summaries feel shallow—they don't replace the real outcome of watching manually." },
        
          ].map(({ icon: Icon, text }, index) => (
            <li key={index} className="flex items-start gap-2 sm:gap-3">
              <span className="text-[#DC143C] mt-0.5">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <span className="text-[#F0F6FC] text-sm sm:text-base">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BetterWayToLearn() {
  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col items-center mb-8 sm:mb-12 px-4">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#F0F6FC] mb-6 sm:mb-8 text-center">Watch Nothing. Learn Everything.<br className="hidden sm:block" />Instantly From Any Video.</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 w-full">
        {/* Segment-by-Segment Breakdown */}
        <div className="bg-[#161B22] rounded-xl p-4 sm:p-6 border border-[#30363D] flex flex-col">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="bg-[#0D47A1] p-1.5 sm:p-2 rounded-lg">
              <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-[#F0F6FC]" />
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-[#F0F6FC]">Complete Knowledge. No Watching Needed.</h3>
          </div>
          <p className="text-[#8B949E] text-sm sm:text-base mb-2">Instantly break down any video into crystal-clear lessons. Get every insight—without playing a single second.</p>
        </div>
        
        {/* Story-Flow Design */}
        <div className="bg-[#161B22] rounded-xl p-4 sm:p-6 border border-[#30363D] flex flex-col">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="bg-[#2962FF] p-1.5 sm:p-2 rounded-lg">
              <Youtube className="w-5 h-5 sm:w-6 sm:h-6 text-[#F0F6FC]" />
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-[#F0F6FC]">Feels Like Watching. But Way Faster.</h3>
          </div>
          <p className="text-[#8B949E] text-sm sm:text-base mb-2">Learn through smart storytelling—like ChatGPT but for any video. Feels natural. Reads fast. Sticks better.
          </p>
        </div>
        
        {/* Lightning-Fast Summaries */}
        <div className="bg-[#161B22] rounded-xl p-4 sm:p-6 border border-[#30363D] flex flex-col">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="bg-[#DC143C] p-1.5 sm:p-2 rounded-lg">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-[#F0F6FC]" />
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-[#F0F6FC]">1 Video = 5 Minutes of Learning</h3>
          </div>
          <p className="text-[#8B949E] text-sm sm:text-base mb-2">Forget spending 30+ mins. Learn everything in 3-5. Full knowledge, no fluff, no skips.</p>
        </div>
        
        {/* Search & Highlight */}
        <div className="bg-[#161B22] rounded-xl p-4 sm:p-6 border border-[#30363D] flex flex-col">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="bg-[#6200EA] p-1.5 sm:p-2 rounded-lg">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-[#F0F6FC]" />
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-[#F0F6FC]">Paste. Read. Done.</h3>
            </div>
          <p className="text-[#8B949E] text-sm sm:text-base mb-2"> Paste a YouTube link and instantly get every key idea. No guilt. No waiting. Just learning that sticks.</p>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [theme, setTheme] = useState('dark');
  const [loadingPlan, setLoadingPlan] = useState<null | 'basic' | 'pro'>(null);
  const [loadingTryFree, setLoadingTryFree] = useState(false);
  const router = useRouter();

  const PLAN_PRODUCT_IDS = {
    basic: '5ee6ffad-ea07-47bf-8219-ad7b77ce4e3f',
    pro: 'a0cb28d8-e607-4063-b3ea-c753178bbf53',
  };

  const handleCheckout = async (productId: string, plan: 'basic' | 'pro') => {
    setLoadingPlan(plan);
    window.location.href = `/api/checkout?productId=${productId}`;
  };

  const handleTryForFree = () => {
    setLoadingTryFree(true);
    router.push('/dashboard/new');
  };

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <Header theme={theme} setTheme={setTheme} />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><ElegantLoader size="lg" /></div>}>
        <main className="relative min-h-screen">
          {/* Hero Section - Mobile Native Design */}
          <div className="flex flex-col min-h-screen pt-20 sm:pt-24 pb-8">
            {/* Top spacing for mobile */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8">
              
              {/* Premium Badge */}
              <div className="flex justify-center mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-2 bg-[#1A1F26]/80 backdrop-blur-md border border-[#30363D]/60 rounded-full px-4 py-2">
                  <div className="w-2 h-2 bg-[#00D4AA] rounded-full animate-pulse"></div>
                  <span className="text-[#00D4AA] text-sm font-medium">AI-Powered Learning</span>
                </div>
              </div>

              {/* Main Headline - Mobile Native Typography with better spacing */}
              <div className="text-center space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight px-2 max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl mx-auto">
                  Why watch for 30 
                  <span className="mx-2">minutes</span>
                  <br className="sm:hidden" />
                  <span className="block sm:inline text-transparent bg-gradient-to-r from-[#DC143C] via-[#DC143C] to-[#DC143C] bg-clip-text">
                    when you can learn it all in 3?
                  </span>
                </h1>

                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-[#A0A8B0] leading-relaxed max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4">
                  Get 100% of the video knowledge in 10% of the time—complete replacement, not basic summaries.
                </p>
              </div>

              {/* CTA Section - Premium Mobile Style */}
              <div className="flex flex-col items-center gap-4 sm:gap-6 space-y-4 sm:space-y-6">
                <button 
                  onClick={handleTryForFree}
                  disabled={loadingTryFree}
                  className="w-full max-w-xs h-12 sm:h-14 bg-gradient-to-r from-[#DC143C] to-[#DC143C] text-white font-semibold text-base sm:text-lg rounded-2xl transition-all duration-300 hover:shadow-[0_8px_32px_rgba(220,20,60,0.4)] active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed relative flex items-center justify-center"
                >
                  {loadingTryFree ? (
                    <div className="flex items-center gap-2">
                      <ElegantLoader size="sm" />
                      <span className="text-white/80">Loading...</span>
                    </div>
                  ) : (
                    'Try for Free'
                  )}
                </button>
                
                {/* Trust indicators */}
                <div className="flex items-center gap-3 sm:gap-4 text-[#6B7280] text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#00D4AA]"></div>
                    <span>No credit card</span>
                  </div>
                  <div className="w-1 h-1 bg-[#6B7280] rounded-full"></div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#00D4AA]"></div>
                    <span>60 min free</span>
                  </div>
                </div>
              </div>

              {/* Features Pills - Mobile Optimized */}
              <div className="flex flex-wrap justify-center gap-2 mt-8 sm:mt-12 px-4">
                {[
                  { icon: "🎯", text: "AI Summary" },
                  { icon: "⚡", text: "Key Points" },
                  { icon: "📝", text: "Full Transcript" },
                  { icon: "💾", text: "Export Notes" }
                ].map(({ icon, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-2 bg-[#1A1F26]/60 backdrop-blur-sm border border-[#30363D]/40 text-[#E5E7EB] rounded-xl px-3 py-2 text-xs sm:text-sm font-medium"
                  >
                    <span className="text-sm sm:text-base">{icon}</span>
                    {text}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Wave - Premium Touch */}
            <div className="relative mt-auto">
              <svg 
                className="w-full h-8 sm:h-12 text-[#161B22]" 
                viewBox="0 0 1200 120" 
                preserveAspectRatio="none"
              >
                <path 
                  d="M1200,120L1200,60C1200,60,1080,0,960,0C840,0,600,60,480,60C360,60,240,0,120,0C60,0,0,30,0,60L0,120Z" 
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>

          {/* Content starts with proper spacing after hero */}
          <div className="bg-[#161B22] relative">
            
            {/* Product Demo Section - Seamless Integration */}
            <section className="w-full flex flex-col items-center pt-12 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-6">
              <div className="text-center mb-8 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">See It In Action</h2>
                <p className="text-[#A0A8B0] text-lg sm:text-xl max-w-2xl mx-auto">
                  Watch how TubeMind transforms a 20-minute video into a 3-minute learning experience
                </p>
              </div>
              
              <div className="relative w-full max-w-4xl mx-auto">
                {/* Premium Device Frame */}
                <div className="bg-gradient-to-b from-[#1A1F26] to-[#161B22] rounded-2xl sm:rounded-3xl p-1 shadow-2xl">
                  <div className="bg-[#0D1117] rounded-xl sm:rounded-2xl overflow-hidden border border-[#30363D]/50">
                    {/* Browser Header */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-[#21262D] border-b border-[#30363D]">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 bg-[#161B22] rounded-lg px-3 py-1">
                        <div className="w-3 h-3 text-[#6B7280]">🔒</div>
                        <span className="text-[#6B7280] text-sm">tubemind.com</span>
                      </div>
                      <div className="w-12"></div>
                    </div>
                    
                    {/* Demo Content */}
                    <div className="h-[280px] sm:h-[400px] md:h-[480px] bg-gradient-to-br from-[#0D1117] via-[#161B22] to-[#1A1F26] flex items-center justify-center relative overflow-hidden">
                      {/* Animated Background Pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-10 left-10 w-20 h-20 border border-[#DC143C] rounded-full animate-pulse"></div>
                        <div className="absolute bottom-10 right-10 w-16 h-16 border border-[#00D4AA] rounded-full animate-pulse delay-1000"></div>
                        <div className="absolute top-1/2 left-1/3 w-12 h-12 border border-[#DC143C] rounded-full animate-pulse delay-500"></div>
                      </div>
                      
                      <div className="text-center z-10">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-r from-[#DC143C] to-[#DC143C] rounded-full flex items-center justify-center">
                          <span className="text-white text-2xl sm:text-3xl transform-gpu animate-pulse-slow">✴</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Demo Coming Soon</h3>
                        <p className="text-[#A0A8B0] text-sm sm:text-base px-4">
                          See how any YouTube video becomes instant knowledge
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Problem With YouTube & Better Way To Learn */}
          <ProblemWithYouTube />
          <BetterWayToLearn />

          {/* What is TubeMind Section */}
          <section className="w-full max-w-4xl mx-auto flex flex-col items-center mb-8 sm:mb-12 px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#F0F6FC] mb-4 sm:mb-6 text-center">Meet TubeMind</h2>
            {/* Why it's different callout */}
            <div className="bg-[#161B22] text-[#F0F6FC] font-semibold text-base sm:text-lg md:text-xl rounded-xl px-4 sm:px-6 md:px-8 py-4 sm:py-6 text-center max-w-3xl shadow-lg border border-[#30363D]">
              <div className="mb-2 sm:mb-3">
                Instantly turns any YouTube video into a <span className="text-[#F0F6FC] bg-[#DC143C] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-sm sm:text-base">3–5 minute</span> readable experience — with the same value as watching it fully.
              </div>
              <div className="text-[#8B949E] text-sm sm:text-base">
                No playback. No skipping. Just <span className="text-[#DC143C] font-semibold">100% of the insights</span>, structured with timestamps — so clear, you won't believe you didn't watch it.
              </div>
            </div>
          </section>

          <CommunitySection />

          {/* Pricing Cards Section */}
          <section id="pricing" className="w-full max-w-7xl mx-auto mt-6 sm:mt-8 flex flex-col items-center px-4">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#F0F6FC] mb-6 sm:mb-8 text-center">Plans that fit your learning journey</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full justify-center max-w-5xl">
              {/* Free Plan Card */}
              <Card className="bg-[#161B22] border-[#30363D] text-[#F0F6FC] w-full max-w-sm mx-auto">
                <CardHeader className="text-center p-4 sm:p-6">
                  <CardTitle className="text-xl sm:text-2xl mb-2">Free</CardTitle>
                  <CardDescription className="text-sm">Try TubeMind for free</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-3xl sm:text-4xl font-bold mb-4 text-center">$0</div>
                  <ul className="mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-xs sm:text-sm text-[#8B949E]">
                    <li className="flex items-center">
                      <span className="text-green-400 mr-2">✔️</span>
                      60 minutes content processing
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="p-4 sm:p-6 pt-0">
                  <button 
                    onClick={handleTryForFree}
                    disabled={loadingTryFree}
                    className="w-full bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] font-semibold py-2.5 sm:py-3 rounded-lg transition cursor-pointer text-sm sm:text-base disabled:opacity-70 disabled:cursor-not-allowed relative flex items-center justify-center min-h-[44px]"
                  >
                    {loadingTryFree ? (
                      <div className="flex items-center gap-2">
                        <ElegantLoader size="sm" />
                        <span className="text-[#F0F6FC]/80">Starting...</span>
                      </div>
                    ) : (
                      'Try for Free'
                    )}
                  </button>
                </CardFooter>
              </Card>

              {/* Basic Plan Card */}
              <Card className="bg-[#161B22] border-[#30363D] text-[#F0F6FC] w-full max-w-sm mx-auto">
                <CardHeader className="text-center p-4 sm:p-6">
                  <CardTitle className="text-xl sm:text-2xl mb-2">Basic</CardTitle>
                  <CardDescription className="text-sm">For everyday learners</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-3xl sm:text-4xl font-bold mb-4 text-center">
                    $9<span className="text-base sm:text-lg font-normal">/mo</span>
                  </div>
                  <ul className="mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-xs sm:text-sm text-[#8B949E]">
                    <li className="flex items-center">
                      <span className="text-green-400 mr-2">✔️</span>
                      1 hr/day content processing (≈1,800 min/mo)
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-400 mr-2">✔️</span>
                      Priority support
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="p-4 sm:p-6 pt-0">
                  <button
                    className="w-full bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] font-semibold py-2.5 sm:py-3 rounded-lg transition disabled:opacity-60 cursor-pointer text-sm sm:text-base relative flex items-center justify-center min-h-[44px]"
                    onClick={() => handleCheckout(PLAN_PRODUCT_IDS.basic, 'basic')}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === 'basic' ? (
                      <div className="flex items-center gap-2">
                        <ElegantLoader size="sm" />
                        <span className="text-[#F0F6FC]/80">Processing...</span>
                      </div>
                    ) : (
                      'Get Basic'
                    )}
                  </button>
                </CardFooter>
              </Card>

              {/* Pro Plan Card - Highlighted */}
              <Card className="bg-[#161B22] border-[#DC143C] border-2 text-[#F0F6FC] w-full max-w-sm mx-auto relative sm:transform sm:scale-105 shadow-2xl sm:col-span-2 lg:col-span-1">
                <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-[#DC143C] text-white px-3 py-0.5 sm:px-4 sm:py-1 rounded-full text-xs sm:text-sm font-semibold">
                    RECOMMENDED
                  </span>
                </div>
                <CardHeader className="text-center p-4 sm:p-6 pt-5 sm:pt-6">
                  <CardTitle className="text-xl sm:text-2xl mb-2">Pro</CardTitle>
                  <CardDescription className="text-sm">For power users & professionals</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-3xl sm:text-4xl font-bold mb-4 text-center">
                    $15<span className="text-base sm:text-lg font-normal">/mo</span>
                  </div>
                  <ul className="mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-xs sm:text-sm text-[#8B949E]">
                    <li className="flex items-center">
                      <span className="text-green-400 mr-2">✔️</span>
                      3 hr/day content processing (≈6,000 min/mo)
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-400 mr-2">✔️</span>
                      Priority support
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-400 mr-2">✔️</span>
                      Early access to new features
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="p-4 sm:p-6 pt-0">
                  <button
                    className="w-full bg-[#DC143C] hover:bg-[#DC143C]/90 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition disabled:opacity-60 cursor-pointer text-sm sm:text-base relative flex items-center justify-center min-h-[44px]"
                    onClick={() => handleCheckout(PLAN_PRODUCT_IDS.pro, 'pro')}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === 'pro' ? (
                      <div className="flex items-center gap-2">
                        <ElegantLoader size="sm" />
                        <span className="text-white/80">Processing...</span>
                      </div>
                    ) : (
                      'Get Pro'
                    )}
                  </button>
                </CardFooter>
              </Card>
            </div>
          </section>
        </main>
      </Suspense>
    </div>
  );
}