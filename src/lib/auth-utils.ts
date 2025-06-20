// 🔒 AUTHENTICATION UTILITIES FOR MONITORING SECURITY
// Prevents unauthorized access to sensitive monitoring data

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export interface AuthResult {
  authorized: boolean;
  userId?: string;
  error?: string;
}

// Check if user is authenticated and has admin role
export async function requireAuth(): Promise<AuthResult> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { authorized: false, error: 'Authentication required' };
    }
    
    return { authorized: true, userId };
  } catch (error: any) {
    return { authorized: false, error: error.message };
  }
}

// Check if user is admin (customize based on your admin logic)
export async function requireAdmin(): Promise<AuthResult> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { authorized: false, error: 'Authentication required' };
    }
    
    // Check if user is admin (customize this logic)
    const isAdmin = await checkIfUserIsAdmin(userId);
    
    if (!isAdmin) {
      return { authorized: false, error: 'Admin access required' };
    }
    
    return { authorized: true, userId };
  } catch (error: any) {
    return { authorized: false, error: error.message };
  }
}

// Check admin status - customize this based on your setup
async function checkIfUserIsAdmin(userId: string): Promise<boolean> {
  // Option 1: Environment variable with admin user IDs
  const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
  if (adminUsers.includes(userId)) {
    return true;
  }
  
  // Option 2: Check database for admin role
  // const user = await db.user.findUnique({ where: { id: userId } });
  // return user?.role === 'admin';
  
  // Option 3: Check Clerk metadata
  // const user = await clerkClient.users.getUser(userId);
  // return user.publicMetadata?.role === 'admin';
  
  return false;
}

// API key authentication for monitoring endpoints
export function requireApiKey(request: NextRequest): AuthResult {
  const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
  const validApiKey = process.env.MONITORING_API_KEY;
  
  if (!validApiKey) {
    return { authorized: false, error: 'Monitoring API key not configured' };
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return { authorized: false, error: 'Invalid API key' };
  }
  
  return { authorized: true };
}

// Create unauthorized response
export function createUnauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json(
    { error: message, timestamp: new Date().toISOString() },
    { status: 401 }
  );
}

// Middleware to secure monitoring endpoints
export async function secureMonitoringEndpoint(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  // Option 1: Require admin authentication
  const authResult = await requireAdmin();
  if (!authResult.authorized) {
    return createUnauthorizedResponse(authResult.error);
  }
  
  // Option 2: Alternative - require API key (uncomment if preferred)
  // const keyResult = requireApiKey(request);
  // if (!keyResult.authorized) {
  //   return createUnauthorizedResponse(keyResult.error);
  // }
  
  return handler();
} 