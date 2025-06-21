// 🔒 AUTHENTICATION UTILITIES FOR MONITORING SECURITY
// Prevents unauthorized access to sensitive monitoring data

import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { User } from '@clerk/nextjs/server';

const sql = neon(process.env.DATABASE_URL!);

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

export async function getUserId() {
  const { userId } = await auth();
  return userId;
}

/**
 * A robust, centralized function to get or create a user in the database.
 * This function prevents race conditions and duplicate user errors by handling
 * user creation and updates in a single, reliable place.
 * 
 * It will:
 * 1. Find the user by their Clerk ID.
 * 2. If not found, find by email to link accounts (e.g., Google login then GitHub login).
 * 3. If not found by either, create a new user record.
 * 
 * @param user The user object from `currentUser()`.
 * @returns The user record from the database.
 */
export async function getOrCreateUser(user: User) {
  // 1. Try to find the user by their Clerk ID.
  let dbUser = (await sql`SELECT id, email FROM users WHERE id = ${user.id}`)[0];

  if (dbUser) {
    // User found by ID. Ensure email is up-to-date.
    if (dbUser.email !== user.emailAddresses[0].emailAddress) {
      await sql`UPDATE users SET email = ${user.emailAddresses[0].emailAddress}, updated_at = NOW() WHERE id = ${user.id}`;
    }
    // Ensure a default subscription exists for this user (permanent fix)
    const existingSub = (await sql`SELECT id FROM subscriptions WHERE user_id = ${user.id}`)[0];
    if (!existingSub) {
      await sql`
        INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end, created_at, updated_at, provider)
        VALUES (
          gen_random_uuid(),
          ${user.id},
          '',
          '',
          'active',
          NOW(),
          NOW() + interval '30 days',
          NOW(),
          NOW(),
          'manual'
        )
      `;
    }
    return (await sql`SELECT * FROM users WHERE id = ${user.id}`)[0];
  }

  // 2. User not found by ID. Try to find by email to link a new login method to an existing account.
  const userEmail = user.emailAddresses[0].emailAddress;
  dbUser = (await sql`SELECT id, email FROM users WHERE email = ${userEmail}`)[0];

  if (dbUser) {
    // User found by email. Update their record with the new Clerk ID.
    await sql`UPDATE users SET id = ${user.id}, updated_at = NOW() WHERE email = ${userEmail}`;
    // Ensure a default subscription exists for this user (permanent fix)
    const existingSub = (await sql`SELECT id FROM subscriptions WHERE user_id = ${user.id}`)[0];
    if (!existingSub) {
      await sql`
        INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end, created_at, updated_at, provider)
        VALUES (
          gen_random_uuid(),
          ${user.id},
          '',
          '',
          'active',
          NOW(),
          NOW() + interval '30 days',
          NOW(),
          NOW(),
          'manual'
        )
      `;
    }
    return (await sql`SELECT * FROM users WHERE id = ${user.id}`)[0];
  }

  // 3. User not found by ID or email. This is a genuinely new user.
  await sql`
    INSERT INTO users (id, email, subscription_tier, subscription_status, credits_used, last_credit_reset)
    VALUES (${user.id}, ${userEmail}, 'free', 'inactive', 0, NOW())
  `;

  // Ensure a default subscription exists for this user (permanent fix)
  const existingSub = (await sql`SELECT id FROM subscriptions WHERE user_id = ${user.id}`)[0];
  if (!existingSub) {
    await sql`
      INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end, created_at, updated_at, provider)
      VALUES (
        gen_random_uuid(),
        ${user.id},
        '',
        '',
        'active',
        NOW(),
        NOW() + interval '30 days',
        NOW(),
        NOW(),
        'manual'
      )
    `;
  }
  
  return (await sql`SELECT * FROM users WHERE id = ${user.id}`)[0];
} 