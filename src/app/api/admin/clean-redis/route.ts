import { NextRequest, NextResponse } from 'next/server';
import { redis, initializeRedis } from '@/lib/redis-client';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 STARTING REDIS QUEUE CLEANUP...');
    
    // Initialize Redis connection
    const isRedisAvailable = await initializeRedis();
    if (!isRedisAvailable || !redis) {
      throw new Error('Redis not available');
    }
    
    // Get the raw data to see what's corrupted
    const rawData = await redis.lpop('video-processing-queue');
    console.log('📄 Raw data found:', rawData);
    
    if (rawData) {
      console.log('🗑️ Removed corrupted data from queue');
    } else {
      console.log('✅ Queue was already empty');
    }
    
    // Clear the entire queue to be safe
    const queueLength = await redis.llen('video-processing-queue');
    console.log('📊 Queue length before cleanup:', queueLength);
    
    if (queueLength > 0) {
      // Remove all items from the queue
      for (let i = 0; i < queueLength; i++) {
        const item = await redis.lpop('video-processing-queue');
        console.log(`🗑️ Removed item ${i + 1}:`, item);
      }
    }
    
    const finalLength = await redis.llen('video-processing-queue');
    console.log('📊 Queue length after cleanup:', finalLength);
    
    return NextResponse.json({
      success: true,
      message: 'Redis queue cleaned successfully',
      itemsRemoved: queueLength,
      finalQueueLength: finalLength
    });

  } catch (error) {
    console.error('❌ Failed to clean Redis queue:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 