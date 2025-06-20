"use strict";
// 🔒 AUTHENTICATION UTILITIES FOR MONITORING SECURITY
// Prevents unauthorized access to sensitive monitoring data
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requireApiKey = requireApiKey;
exports.createUnauthorizedResponse = createUnauthorizedResponse;
exports.secureMonitoringEndpoint = secureMonitoringEndpoint;
const server_1 = require("@clerk/nextjs/server");
const server_2 = require("next/server");
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
