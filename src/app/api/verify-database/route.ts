import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    // Test 1: Check if constraints exist
    const constraints = await sql`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
      AND constraint_name LIKE 'chk_%'
    `;

    // Test 2: Check if functions exist
    const functions = await sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('reset_monthly_credits', 'can_user_access_video_processing', 'audit_subscription_changes')
    `;

    // Test 3: Check if subscription_audit table exists
    const auditTable = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'subscription_audit'
    `;

    // Test 4: Check if triggers exist
    const triggers = await sql`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public' 
      AND trigger_name = 'subscription_change_audit'
    `;

    // Test 5: Check if indexes exist
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `;

    // Test 6: Test the view with sample data
    const viewTest = await sql`
      SELECT COUNT(*) as user_count
      FROM user_subscription_summary
    `;

    // Test 7: Test the database function
    let functionTest = null;
    try {
      functionTest = await sql`SELECT reset_monthly_credits() as reset_count`;
    } catch (e) {
      functionTest = { error: 'Function not found or failed' };
    }

    return NextResponse.json({
      success: true,
      verification: {
        constraints: constraints.length > 0 ? constraints : 'Not found - may need to add',
        functions: functions.map(f => f.routine_name),
        auditTable: auditTable.length > 0 ? 'Found' : 'Not found - may need to add',
        triggers: triggers.length > 0 ? triggers : 'Not found - may need to add',
        indexes: indexes.map(i => i.indexname),
        viewTest: viewTest[0],
        functionTest: functionTest
      },
      recommendations: {
        needsConstraints: constraints.length === 0,
        needsAuditTable: auditTable.length === 0,
        needsTriggers: triggers.length === 0,
        allGood: constraints.length > 0 && auditTable.length > 0 && triggers.length > 0
      }
    });

  } catch (error: any) {
    console.error('Database verification error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 