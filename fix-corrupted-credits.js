const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function fixCorruptedCredits() {
  console.log('🔧 Starting credit corruption fix...');
  
  try {
    // 1. Reset any negative credits_reserved to 0
    console.log('📊 Fixing negative credits_reserved...');
    const negativeResult = await sql`
      UPDATE users 
      SET credits_reserved = 0 
      WHERE credits_reserved < 0
      RETURNING id, credits_reserved
    `;
    console.log(`✅ Fixed ${negativeResult.length} users with negative credits_reserved`);

    // 2. Reset any credits_reserved that exceed the user's limit
    console.log('📊 Fixing credits_reserved that exceed limits...');
    const exceedResult = await sql`
      UPDATE users u
      SET credits_reserved = 0
      WHERE credits_reserved > COALESCE(credits_limit, 60)
      RETURNING id, credits_reserved, credits_limit
    `;
    console.log(`✅ Fixed ${exceedResult.length} users with excessive credits_reserved`);

    // 3. Reset credits_reserved for users with no active processing jobs
    console.log('📊 Fixing stale credits_reserved...');
    const staleResult = await sql`
      UPDATE users u
      SET credits_reserved = 0
      WHERE credits_reserved > 0
        AND NOT EXISTS (
          SELECT 1
          FROM video_summaries vs
          JOIN videos v ON v.id = vs.video_id
          WHERE v.user_id = u.id
            AND vs.processing_status IN ('queued','processing','transcribing','summarizing','finalizing')
        )
      RETURNING id, credits_reserved
    `;
    console.log(`✅ Fixed ${staleResult.length} users with stale credits_reserved`);

    // 4. Show summary of all users
    console.log('📊 Current credit status:');
    const summary = await sql`
      SELECT 
        id,
        subscription_tier,
        credits_used,
        credits_limit,
        credits_reserved,
        (credits_limit - credits_used - GREATEST(0, credits_reserved)) as available_credits
      FROM users
      ORDER BY available_credits ASC
      LIMIT 10
    `;
    
    console.table(summary);
    
    console.log('✅ Credit corruption fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing corrupted credits:', error);
    process.exit(1);
  }
}

// Run the fix
fixCorruptedCredits().then(() => {
  console.log('🎉 All done!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
}); 