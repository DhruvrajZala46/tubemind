import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../../lib/db';
import { createLogger } from '../../../../lib/logger';
import { requireAdmin, createUnauthorizedResponse } from '../../../../lib/auth-utils';

const logger = createLogger('api:migrate-db');

export async function POST(request: NextRequest) {
  // SECURITY: Require admin authentication
  const authResult = await requireAdmin();
  if (!authResult.authorized) {
    logger.warn('Unauthorized access attempt to migrate-db endpoint', {
      data: { error: authResult.error, ip: request.ip || 'unknown' }
    });
    return createUnauthorizedResponse(authResult.error);
  }

  try {
    logger.info('Running database migration for processing progress columns');
    
    await executeQuery(async (sql) => {
      // Add processing_progress column (0-100 percentage)
      await sql`
        ALTER TABLE video_summaries
        ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 0
      `;
      
      // Add processing_stage column (more detailed than processing_status)
      await sql`
        ALTER TABLE video_summaries
        ADD COLUMN IF NOT EXISTS processing_stage VARCHAR DEFAULT NULL
      `;
      
      // Add index for faster status lookups
      await sql`
        CREATE INDEX IF NOT EXISTS idx_video_summaries_processing_status 
        ON video_summaries(processing_status)
      `;
      
      // Update existing rows to have consistent values
      await sql`
        UPDATE video_summaries
        SET 
          processing_progress = CASE
            WHEN processing_status = 'completed' OR processing_status = 'complete' THEN 100
            WHEN processing_status = 'failed' THEN 0
            ELSE 10
          END,
          processing_stage = COALESCE(processing_status, 'pending')
        WHERE processing_progress IS NULL OR processing_stage IS NULL
      `;
    });
    
    logger.info('Database migration completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully'
    });
    
  } catch (error: any) {
    logger.error('Database migration failed', { error: error.message, stack: error.stack });
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 