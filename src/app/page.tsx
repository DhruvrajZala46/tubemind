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
    <header className="fixed top-0 left-0 w-full z-30 bg-black/80 backdrop-blur-md border-b border-[var(--border-color)]">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        {/* Desktop: left logo, right menu; Mobile: centered logo, right hamburger */}
        <div className="flex flex-1 items-center justify-between w-full">
          {/* Logo/brand: left on desktop, centered on mobile */}
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-2">
            <Link href="/" className="flex items-center gap-1 group align-middle">
              <img src="/logo.svg" alt="TubeMind Logo" className="w-12 h-12 animate-spin-slow" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
              <span className="text-[var(--text-primary)] font-semibold text-xl sm:text-2xl" style={{lineHeight:'1',verticalAlign:'middle'}}>TubeMind</span>
            </Link>
          </div>
          {/* Desktop menu and actions */}
          <div className="hidden lg:flex items-center gap-8 text-[var(--text-secondary)] font-medium ml-auto">
            <a href="#problem-with-youtube" className="hover:text-white transition cursor-pointer">Features</a>
            <a href="#pricing" className="hover:text-white transition cursor-pointer">Pricing</a>
            <a href="#about" className="hover:text-white transition cursor-pointer">About</a>
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-[var(--text-primary)] bg-transparent hover:bg-white/10 rounded-full transition font-medium cursor-pointer text-base pill-btn ml-4">
                  Sign in
                </button>
              </SignInButton>
            )}
            <button
              onClick={handleGetStarted}
              className="px-5 py-2 bg-[var(--btn-primary-bg)] hover:bg-white/90 text-[var(--btn-primary-text)] rounded-full transition font-semibold cursor-pointer text-base pill-btn shadow-md ml-2"
            >
              Get Started
            </button>
          </div>
          {/* Hamburger for mobile */}
          <div className="flex lg:hidden items-center gap-2 ml-auto">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 w-10 h-10 rounded-xl bg-transparent hover:bg-white/10 text-[var(--text-primary)] transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/10 flex items-center justify-center"
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
          <div className="bg-[var(--card-bg)] border-b border-[var(--border-color)] shadow-lg p-4 flex flex-col gap-4 animate-slide-in-left relative">
            <div className="flex items-center gap-1 justify-center mb-2">
              <Link href="/" className="flex items-center gap-1 group align-middle">
                <img src="/logo.svg" alt="TubeMind Logo" className="w-12 h-12 animate-spin-slow" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                <span className="text-[var(--text-primary)] font-semibold text-xl" style={{lineHeight:'1',verticalAlign:'middle'}}>TubeMind</span>
              </Link>
            </div>
            <a href="#problem-with-youtube" className="block text-[var(--text-secondary)] hover:text-white text-base font-medium py-2 rounded-xl text-center transition">Features</a>
            <a href="#pricing" className="block text-[var(--text-secondary)] hover:text-white text-base font-medium py-2 rounded-xl text-center transition">Pricing</a>
            <a href="#about" className="block text-[var(--text-secondary)] hover:text-white text-base font-medium py-2 rounded-xl text-center transition">About</a>
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button className="w-full py-3 bg-white/10 hover:bg-white/20 text-[var(--text-primary)] rounded-full font-semibold text-base pill-btn mt-2">Sign in</button>
              </SignInButton>
            )}
            <button
              onClick={handleGetStarted}
              className="w-full py-3 bg-[var(--btn-primary-bg)] hover:bg-white/90 text-[var(--btn-primary-text)] rounded-full font-semibold text-base pill-btn shadow-md mt-2"
            >
              Get Started
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[var(--text-primary)] focus:outline-none"
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
          className="flex items-center gap-1.5 sm:gap-2 bg-[var(--card-bg)] hover:bg-white/10 text-[var(--text-primary)] rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 font-medium text-xs sm:text-sm transition border border-[var(--border-color)] cursor-pointer"
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
    <section className="w-full bg-transparent border-t border-b border-[var(--border-color)] mt-16 mb-8 py-10 px-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[var(--text-primary)]">From the Community</h2>
        <Link href="#" className="text-[var(--text-primary)] hover:text-white font-medium flex items-center gap-1">
          View All <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="text-[var(--text-secondary)]">
        Discover how others are using TubeMind to transform their learning experience.
      </div>
    </section>
  );
}

function ProblemWithYouTube() {
  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-6 sm:gap-8 mb-8 sm:mb-12 px-4">
      <div className="flex-1 bg-transparent rounded-xl p-4 sm:p-6 md:p-8 border border-[var(--border-color)] shadow-lg">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-4 sm:mb-6">YouTube Is Packed with Value—But Here's the Catch</h2>
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
              <span className="text-[var(--text-primary)] mt-0.5">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <span className="text-[var(--text-primary)] text-sm sm:text-base">{text}</span>
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
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6 sm:mb-8 text-center">Watch Nothing. Learn Everything.<br className="hidden sm:block" />Instantly From Any Video.</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 w-full">
        {/* Segment-by-Segment Breakdown */}
        <div className="bg-[var(--card-bg)] rounded-xl p-4 sm:p-6 border border-[var(--border-color)] flex flex-col">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="bg-white/10 p-1.5 sm:p-2 rounded-lg">
              <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-primary)]" />
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">Complete Knowledge. No Watching Needed.</h3>
          </div>
          <p className="text-[var(--text-secondary)] text-sm sm:text-base mb-2">Instantly break down any video into crystal-clear lessons. Get every insight—without playing a single second.</p>
        </div>
        
        {/* Story-Flow Design */}
        <div className="bg-[var(--card-bg)] rounded-xl p-4 sm:p-6 border border-[var(--border-color)] flex flex-col">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="bg-white/10 p-1.5 sm:p-2 rounded-lg">
              <Youtube className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-primary)]" />
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">Feels Like Watching. But Way Faster.</h3>
          </div>
          <p className="text-[var(--text-secondary)] text-sm sm:text-base mb-2">Learn through smart storytelling—like ChatGPT but for any video. Feels natural. Reads fast. Sticks better.
          </p>
        </div>
        
        {/* Lightning-Fast Summaries */}
        <div className="bg-[var(--card-bg)] rounded-xl p-4 sm:p-6 border border-[var(--border-color)] flex flex-col">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="bg-white/10 p-1.5 sm:p-2 rounded-lg">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-primary)]" />
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">1 Video = 5 Minutes of Learning</h3>
          </div>
          <p className="text-[var(--text-secondary)] text-sm sm:text-base mb-2">Forget spending 30+ mins. Learn everything in 3-5. Full knowledge, no fluff, no skips.</p>
        </div>
        
        {/* Search & Highlight */}
        <div className="bg-[var(--card-bg)] rounded-xl p-4 sm:p-6 border border-[var(--border-color)] flex flex-col">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="bg-white/10 p-1.5 sm:p-2 rounded-lg">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-primary)]" />
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">Paste. Read. Done.</h3>
            </div>
          <p className="text-[var(--text-secondary)] text-sm sm:text-base mb-2"> Paste a YouTube link and instantly get every key idea. No guilt. No waiting. Just learning that sticks.</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="w-full border-t border-[var(--border-color)] mt-16 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="TubeMind Logo" className="w-8 h-8" />
            <span className="text-[var(--text-primary)] font-semibold">TubeMind</span>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <a href="/about" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition">About</a>
            <a href="/contact" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition">Contact</a>
          </div>
          
          <div className="flex items-center gap-4">
            <a href="https://twitter.com/tubemind" target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
            </a>
            <a href="https://github.com/tubemind" target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
            </a>
            <a href="https://linkedin.com/company/tubemind" target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
            </a>
          </div>
        </div>
        <div className="mt-6 text-center text-[var(--text-secondary)] text-xs">
          © {new Date().getFullYear()} TubeMind. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const [theme, setTheme] = useState('dark');
  const [loadingPlan, setLoadingPlan] = useState<null | 'basic' | 'pro'>(null);
  const [loadingTryFree, setLoadingTryFree] = useState(false);
  const router = useRouter();

  const PLAN_PRODUCT_IDS = {
    basic: '861cd62e-ceb6-4beb-8c06-43a8652eae8c',
    pro: '4b2f5d5d-cba5-4ec2-b80e-d9053eec75b5',
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
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Header theme={theme} setTheme={setTheme} />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><ElegantLoader size="lg" /></div>}>
        <main className="relative min-h-screen">
          {/* Hero Section - Mobile Native Design */}
          <div className="flex flex-col min-h-screen pt-20 sm:pt-24 pb-8">
            {/* Top spacing for mobile */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8">
              
              {/* Premium Badge */}
              <div className="flex justify-center mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md border border-[var(--border-color)] rounded-full px-4 py-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-[var(--text-primary)] text-sm font-medium">AI-Powered Learning</span>
                </div>
              </div>

              {/* Main Headline - Mobile Native Typography with better spacing */}
              <div className="text-center space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] leading-tight tracking-tight px-2 max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl mx-auto">
                  Why watch for 30 
                  <span className="mx-2">minutes</span>
                  <br className="sm:hidden" />
                  <span className="block sm:inline">
                    when you can learn it all in 3?
                  </span>
                </h1>

                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-[var(--text-secondary)] leading-relaxed max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-4">
                  complete replacement, not basic summaries.
                </p>
              </div>

              {/* CTA Section - Premium Mobile Style */}
              <div className="flex flex-col items-center gap-4 sm:gap-6 space-y-4 sm:space-y-6">
                <button 
                  onClick={handleTryForFree}
                  disabled={loadingTryFree}
                  className="w-full max-w-xs h-12 sm:h-14 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-semibold text-base sm:text-lg rounded-2xl transition-all duration-300 hover:shadow-none active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed relative flex items-center justify-center"
                >
                  {loadingTryFree ? (
                    <div className="flex items-center gap-2">
                      <ElegantLoader size="sm" />
                      <span className="text-black/80">Loading..</span>
                    </div>
                  ) : (
                    'Try for Free'
                  )}
                </button>
                
                {/* Trust indicators */}
                <div className="flex items-center gap-3 sm:gap-4 text-[var(--text-secondary)] text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white"></div>
                    <span>No credit card</span>
                  </div>
                  <div className="w-1 h-1 bg-[var(--text-secondary)] rounded-full"></div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white"></div>
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
                    className="flex items-center gap-2 bg-[var(--card-bg)] backdrop-blur-sm border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-xs sm:text-sm font-medium"
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
                className="w-full h-8 sm:h-12 text-black" 
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
          <div className="bg-[var(--bg-primary)] relative">
            
            {/* Product Demo Section - Seamless Integration */}
            <section className="w-full flex flex-col items-center pt-12 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-6">
              <div className="text-center mb-8 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-3 sm:mb-4">See It In Action</h2>
                <p className="text-[var(--text-secondary)] text-lg sm:text-xl max-w-2xl mx-auto">
                  Watch how TubeMind transforms a 20-minute video into a 3-minute learning experience
                </p>
              </div>
              
              <div className="relative w-full max-w-4xl mx-auto">
                {/* Premium Device Frame */}
                <div className="bg-gradient-to-b from-[#111] to-[#000] rounded-2xl sm:rounded-3xl p-1 shadow-2xl">
                  <div className="bg-black rounded-xl sm:rounded-2xl overflow-hidden border border-[var(--border-color)]">
                    {/* Browser Header */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-[var(--card-bg)] border-b border-[var(--border-color)]">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 bg-black rounded-lg px-3 py-1">
                        <div className="w-3 h-3 text-[var(--text-secondary)]">🔒</div>
                        <span className="text-[var(--text-secondary)] text-sm">tubemind.com</span>
                      </div>
                      <div className="w-12"></div>
                    </div>
                    
                    {/* Demo Content */}
                    <div className="h-[280px] sm:h-[400px] md:h-[480px] bg-gradient-to-br from-black via-[#111] to-black flex items-center justify-center relative overflow-hidden">
                      {/* Animated Background Pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-10 left-10 w-20 h-20 border border-white rounded-full animate-pulse"></div>
                        <div className="absolute bottom-10 right-10 w-16 h-16 border border-white rounded-full animate-pulse delay-1000"></div>
                        <div className="absolute top-1/2 left-1/3 w-12 h-12 border border-white rounded-full animate-pulse delay-500"></div>
                      </div>
                      
                      <div className="text-center z-10">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-r from-white/80 to-white rounded-full flex items-center justify-center">
                          <span className="text-black text-2xl sm:text-3xl transform-gpu animate-pulse-slow">✴</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">Demo Coming Soon</h3>
                        <p className="text-[var(--text-secondary)] text-sm sm:text-base px-4">
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
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4 sm:mb-6 text-center">Meet TubeMind</h2>
            {/* Why it's different callout */}
            <div className="bg-[var(--card-bg)] text-[var(--text-primary)] font-semibold text-base sm:text-lg md:text-xl rounded-xl px-4 sm:px-6 md:px-8 py-4 sm:py-6 text-center max-w-3xl shadow-lg border border-[var(--border-color)]">
              <div className="mb-2 sm:mb-3">
                Instantly turns any YouTube video into a <span className="text-black bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-sm sm:text-base">3–5 minute</span> readable experience — with the same value as watching it fully.
              </div>
              <div className="text-[var(--text-secondary)] text-sm sm:text-base">
                No playback. No skipping. Just <span className="text-white font-semibold">100% of the insights</span>, structured with timestamps — so clear, you won't believe you didn't watch it.
              </div>
            </div>
          </section>

          <CommunitySection />

          {/* Pricing Cards Section */}
          <section id="pricing" className="w-full max-w-7xl mx-auto mt-6 sm:mt-8 flex flex-col items-center px-4">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2 sm:mb-4 text-center">Plans that fit your learning journey</h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl text-center mb-6">
            You only pay for the <span className="font-semibold text-white">total minutes</span> of content you process — not the number of videos. For example, if you process a 30-minute video, it uses 30 minutes from your monthly balance.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full justify-center max-w-5xl">
              {/* Free Plan Card */}
              <Card className="bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] w-full max-w-sm mx-auto">
                <CardHeader className="text-center p-4 sm:p-6">
                  <CardTitle className="text-xl sm:text-2xl mb-2">Free</CardTitle>
                  <CardDescription className="text-sm text-[var(--text-secondary)]">Try TubeMind for free</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-3xl sm:text-4xl font-bold mb-4 text-center">$0</div>
                  <ul className="mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                    <li className="flex items-center">
                      <span className="text-[var(--text-primary)] mr-2">✔️</span>
                      60 minutes total — use it on any number of videos.
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="p-4 sm:p-6 pt-0">
                  <button 
                    onClick={handleTryForFree}
                    disabled={loadingTryFree}
                    className="w-full bg-transparent border border-white/20 hover:bg-white/10 text-[var(--text-primary)] font-semibold py-2.5 sm:py-3 rounded-lg transition cursor-pointer text-sm sm:text-base disabled:opacity-70 disabled:cursor-not-allowed relative flex items-center justify-center min-h-[44px]"
                  >
                    {loadingTryFree ? (
                      <div className="flex items-center gap-2">
                        <ElegantLoader size="sm" />
                        <span className="text-[var(--text-primary)]/80">Starting...</span>
                      </div>
                    ) : (
                      'Try for Free'
                    )}
                  </button>
                </CardFooter>
              </Card>

              {/* Basic Plan Card */}
              <Card className="bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] w-full max-w-sm mx-auto">
                <CardHeader className="text-center p-4 sm:p-6">
                  <CardTitle className="text-xl sm:text-2xl mb-2">Basic</CardTitle>
                  <CardDescription className="text-sm text-[var(--text-secondary)]">For everyday learners</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-3xl sm:text-4xl font-bold mb-4 text-center">
                    $9<span className="text-base sm:text-lg font-normal">/mo</span>
                  </div>
                  <ul className="mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                    <li className="flex items-center">
                      <span className="text-[var(--text-primary)] mr-2">✔️</span>
                      1,800 minutes a month — use it on any number of videos.
                    </li>
                    <li className="flex items-center">
                      <span className="text-[var(--text-primary)] mr-2">✔️</span>
                      Priority support
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="p-4 sm:p-6 pt-0">
                  <button
                    className="w-full bg-transparent border border-white/20 hover:bg-white/10 text-[var(--text-primary)] font-semibold py-2.5 sm:py-3 rounded-lg transition disabled:opacity-60 cursor-pointer text-sm sm:text-base relative flex items-center justify-center min-h-[44px]"
                    onClick={() => handleCheckout(PLAN_PRODUCT_IDS.basic, 'basic')}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === 'basic' ? (
                      <div className="flex items-center gap-2">
                        <ElegantLoader size="sm" />
                        <span className="text-[var(--text-primary)]/80">Processing...</span>
                      </div>
                    ) : (
                      'Get Basic'
                    )}
                  </button>
                </CardFooter>
              </Card>

              {/* Pro Plan Card - Highlighted */}
              <Card className="bg-[var(--card-bg)] border-[var(--btn-primary-bg)] border-2 text-[var(--text-primary)] w-full max-w-sm mx-auto relative sm:transform sm:scale-105 shadow-2xl sm:col-span-2 lg:col-span-1">
                <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] px-3 py-0.5 sm:px-4 sm:py-1 rounded-full text-xs sm:text-sm font-semibold">
                    RECOMMENDED
                  </span>
                </div>
                <CardHeader className="text-center p-4 sm:p-6 pt-5 sm:pt-6">
                  <CardTitle className="text-xl sm:text-2xl mb-2">Pro</CardTitle>
                  <CardDescription className="text-sm text-[var(--text-secondary)]">For power users & professionals</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-3xl sm:text-4xl font-bold mb-4 text-center">
                    $15<span className="text-base sm:text-lg font-normal">/mo</span>
                  </div>
                  <ul className="mb-4 sm:mb-6 space-y-2 sm:space-y-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                    <li className="flex items-center">
                      <span className="text-[var(--text-primary)] mr-2">✔️</span>
                      6,000 minutes a month — use it on any number of videos.
                    </li>
                    <li className="flex items-center">
                      <span className="text-[var(--text-primary)] mr-2">✔️</span>
                      Priority support
                    </li>
                    <li className="flex items-center">
                      <span className="text-[var(--text-primary)] mr-2">✔️</span>
                      Early access to new features
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="p-4 sm:p-6 pt-0">
                  <button
                    className="w-full bg-[var(--btn-primary-bg)] hover:bg-white/90 text-[var(--btn-primary-text)] font-semibold py-2.5 sm:py-3 rounded-lg transition disabled:opacity-60 cursor-pointer text-sm sm:text-base relative flex items-center justify-center min-h-[44px]"
                    onClick={() => handleCheckout(PLAN_PRODUCT_IDS.pro, 'pro')}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === 'pro' ? (
                      <div className="flex items-center gap-2">
                        <ElegantLoader size="sm" />
                        <span className="text-black/80">Processing...</span>
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
      <Footer />
    </div>
  );
}
