import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your middleware

// Create a development bypass middleware for testing without auth
const bypassAuthMiddleware = (req: NextRequest) => {
  console.log('🔓 Development mode: bypassing authentication');
  
  // Add security headers to all responses
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;");
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  
  return response;
};

// Choose the appropriate middleware based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const shouldBypassAuth = process.env.DEBUG_BYPASS_AUTH === 'true';

// SECURITY FIX: Prevent auth bypass in production
if (process.env.NODE_ENV === 'production' && shouldBypassAuth) {
  console.error('⚠️ CRITICAL SECURITY ERROR: Attempted to bypass authentication in production');
  throw new Error('Authentication bypass is not allowed in production');
}

// Use bypass middleware in development mode if DEBUG_BYPASS_AUTH is set
const middleware = isDevelopment && shouldBypassAuth 
  ? bypassAuthMiddleware 
  : clerkMiddleware((auth) => {
      // Add security headers to all responses
      const response = NextResponse.next();
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;");
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      
      return response;
    });

export default middleware;

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}; 