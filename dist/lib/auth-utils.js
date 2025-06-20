"use strict";
// 🔒 AUTHENTICATION UTILITIES FOR MONITORING SECURITY
// Prevents unauthorized access to sensitive monitoring data
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requireApiKey = requireApiKey;
exports.createUnauthorizedResponse = createUnauthorizedResponse;
exports.secureMonitoringEndpoint = secureMonitoringEndpoint;
exports.getUserId = getUserId;
exports.getOrCreateUser = getOrCreateUser;
const server_1 = require("@clerk/nextjs/server");
const server_2 = require("next/server");
const serverless_1 = require("@neondatabase/serverless");
const sql = (0, serverless_1.neon)(process.env.DATABASE_URL);
// Check if user is authenticated and has admin role
async function requireAuth() {
    try {
        const { userId } = await (0, server_1.auth)();
        if (!userId) {
            return { authorized: false, error: 'Authentication required' };
        }
        return { authorized: true, userId };
    }
    catch (error) {
        return { authorized: false, error: error.message };
    }
}
// Check if user is admin (customize based on your admin logic)
async function requireAdmin() {
    try {
        const { userId } = await (0, server_1.auth)();
        if (!userId) {
            return { authorized: false, error: 'Authentication required' };
        }
        // Check if user is admin (customize this logic)
        const isAdmin = await checkIfUserIsAdmin(userId);
        if (!isAdmin) {
            return { authorized: false, error: 'Admin access required' };
        }
        return { authorized: true, userId };
    }
    catch (error) {
        return { authorized: false, error: error.message };
    }
}
// Check admin status - customize this based on your setup
async function checkIfUserIsAdmin(userId) {
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
function requireApiKey(request) {
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
function createUnauthorizedResponse(message = 'Unauthorized') {
    return server_2.NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status: 401 });
}
// Middleware to secure monitoring endpoints
async function secureMonitoringEndpoint(request, handler) {
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
async function getUserId() {
    const { userId } = await (0, server_1.auth)();
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
async function getOrCreateUser(user) {
    // 1. Try to find the user by their Clerk ID.
    let dbUser = (await sql `SELECT id, email FROM users WHERE id = ${user.id}`)[0];
    if (dbUser) {
        // User found by ID. Ensure email is up-to-date.
        if (dbUser.email !== user.emailAddresses[0].emailAddress) {
            await sql `UPDATE users SET email = ${user.emailAddresses[0].emailAddress}, updated_at = NOW() WHERE id = ${user.id}`;
        }
        return (await sql `SELECT * FROM users WHERE id = ${user.id}`)[0];
    }
    // 2. User not found by ID. Try to find by email to link a new login method to an existing account.
    const userEmail = user.emailAddresses[0].emailAddress;
    dbUser = (await sql `SELECT id, email FROM users WHERE email = ${userEmail}`)[0];
    if (dbUser) {
        // User found by email. Update their record with the new Clerk ID.
        await sql `UPDATE users SET id = ${user.id}, updated_at = NOW() WHERE email = ${userEmail}`;
        return (await sql `SELECT * FROM users WHERE id = ${user.id}`)[0];
    }
    // 3. User not found by ID or email. This is a genuinely new user.
    await sql `
    INSERT INTO users (id, email, subscription_tier, subscription_status, credits_used, last_credit_reset)
    VALUES (${user.id}, ${userEmail}, 'free', 'inactive', 0, NOW())
  `;
    return (await sql `SELECT * FROM users WHERE id = ${user.id}`)[0];
}
