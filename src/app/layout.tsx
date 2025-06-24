import type { Metadata } from "next";
import "@fontsource/inter/900.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/400.css";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
// import { Analytics } from '@vercel/analytics/react';
import { Suspense } from 'react';
import { GlobalSkeleton } from '../components/ui/global-skeleton';
// import { SentryErrorBoundary } from '../components/ui/sentry-error-boundary';
import { PaywallProvider } from '../components/ui/paywall-provider';
import { CreditProvider } from '../lib/credit-context';

export const metadata: Metadata = {
  title: "TubeMind - YouTube Video Summarizer",
  description: "Extract knowledge from any YouTube video instantly with AI-powered summaries.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="icon" href="/favicon.ico" />
        </head>
        <body className="antialiased font-sans" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {/* <SentryErrorBoundary> */}
            <CreditProvider>
              <PaywallProvider>
                <Suspense fallback={<GlobalSkeleton />}>
                  <Toaster position="top-right" theme="dark" />
                  {children}
                </Suspense>
              </PaywallProvider>
            </CreditProvider>
          {/* </SentryErrorBoundary> */}
        </body>
      </html>
    </ClerkProvider>
  );
}
