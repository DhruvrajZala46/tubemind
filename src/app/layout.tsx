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
  metadataBase: new URL('https://www.tubemind.live/'),
  title: {
    default: 'TubeMind - Watch Less Learn More',
    template: '%s | TubeMind',
  },
  description:
    'TubeMind – the AI-powered YouTube assistant. Generate instant, accurate video summaries and dive straight to the knowledge you need.',
  keywords: [
    'TubeMind',
    'ChatGPT for YouTube',
    'YouTube video summaries',
    'AI summarizer',
    'Video summarizer',
    'YouTube transcript',
    'YouTube AI',
  ],
  openGraph: {
    title: 'TubeMind - Watch Less Learn More',
    description:
      'TubeMind – the AI-powered YouTube assistant. Generate instant, accurate video summaries and dive straight to the knowledge you need.',
    url: 'https://www.tubemind.live/',
    siteName: 'TubeMind',
    images: [
      {
        url: 'https://www.tubemind.live/opengraph-image.png', // ABSOLUTE URL
        width: 1200,
        height: 630,
        alt: 'TubeMind – AI-powered YouTube Video Summaries',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TubeMind - Watch Less Learn More',
    description:
      'TubeMind – the AI-powered YouTube assistant. Generate instant, accurate video summaries and dive straight to the knowledge you need.',
      images: ['https://www.tubemind.live/opengraph-image.png'], // ABSOLUTE HERE TOO
      creator: '@TubeMind',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: 'https://www.tubemind.live/',
  },
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
        <body className="antialiased font-sans" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
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
