import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../../lib/logger';
import env from '../../../../lib/env';

const sql = neon(env.DATABASE_URL);
const logger = createLogger('payment:webhook-test');

/**
 * Test endpoint to simulate Polar webhooks for debugging
 * This allows us to test our webhook handling without actual Polar events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, email, product_id } = body;
    
    logger.info(`Simulating webhook event: ${type}`, { data: { email, product_id } });
    
    if (!type || !email) {
      return NextResponse.json({ error: 'Missing required fields: type, email' }, { status: 400 });
    }
    
    // Create a simulated webhook event based on the type
    let simulatedData: any = {};
    
    switch (type) {
      case 'subscription.created':
        simulatedData = {
          id: `test_sub_${Date.now()}`,
          customer: { email },
          product_id: product_id || 'c2dc830c-17d2-436a-aedb-b74c2a79837a', // Default to Pro plan
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        };
        break;
        
      case 'checkout.updated':
        simulatedData = {
          id: `test_checkout_${Date.now()}`,
          customer_email: email,
          product_id: product_id || 'c2dc830c-17d2-436a-aedb-b74c2a79837a', // Default to Pro plan
          status: 'confirmed'
        };
        break;
        
      default:
        return NextResponse.json({ error: `Unsupported event type: ${type}` }, { status: 400 });
    }
    
    // Merge with any custom data provided
    if (data) {
      simulatedData = { ...simulatedData, ...data };
    }
    
    // Process the simulated webhook event directly
    try {
      // For subscription.created
      if (type === 'subscription.created') {
        const tier = getSubscriptionTier(simulatedData.product_id);
        
        // Update user subscription details
        const updateResult = await sql`
          UPDATE users 
          SET 
            subscription_tier = ${tier},
            subscription_status = 'active',
            subscription_id = ${simulatedData.id},
            subscription_end_date = ${simulatedData.current_period_end},
            credits_used = 0,
            last_credit_reset = NOW(),
            updated_at = NOW()
          WHERE email = ${simulatedData.customer.email}
          RETURNING id, email, subscription_tier
        `;
        
        if (updateResult.length > 0) {
          logger.info(`✅ Test webhook: Subscription created for user: ${email} with tier: ${tier}`);
          
          // Verify the update was successful
          const verifyResult = await sql`
            SELECT subscription_tier, subscription_status, credits_used 
            FROM users 
            WHERE email = ${simulatedData.customer.email}
          `;
          
          if (verifyResult.length > 0) {
            logger.info(`✅ Verification: User ${email} now has tier: ${verifyResult[0].subscription_tier}, status: ${verifyResult[0].subscription_status}`);
            
            return NextResponse.json({ 
              success: true, 
              message: `Subscription updated for ${email}`,
              details: {
                tier: verifyResult[0].subscription_tier,
                status: verifyResult[0].subscription_status,
                credits_used: verifyResult[0].credits_used
              }
            });
          }
        } else {
          logger.warn(`🚨 No user found with email: ${email}`);
          return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
        }
      }
      
      // For checkout.updated
      if (type === 'checkout.updated') {
        const tier = getSubscriptionTier(simulatedData.product_id);
        
        // Update user subscription details
        const updateResult = await sql`
          UPDATE users 
          SET 
            subscription_tier = ${tier},
            subscription_status = 'active',
            credits_used = 0,
            last_credit_reset = NOW(),
            updated_at = NOW()
          WHERE email = ${simulatedData.customer_email}
          RETURNING id, email, subscription_tier
        `;
        
        if (updateResult.length > 0) {
          logger.info(`✅ Test webhook: Checkout confirmed for user: ${email} with tier: ${tier}`);
          
          // Verify the update was successful
          const verifyResult = await sql`
            SELECT subscription_tier, subscription_status, credits_used 
            FROM users 
            WHERE email = ${simulatedData.customer_email}
          `;
          
          if (verifyResult.length > 0) {
            logger.info(`✅ Verification: User ${email} now has tier: ${verifyResult[0].subscription_tier}, status: ${verifyResult[0].subscription_status}`);
            
            return NextResponse.json({ 
              success: true, 
              message: `Subscription updated for ${email}`,
              details: {
                tier: verifyResult[0].subscription_tier,
                status: verifyResult[0].subscription_status,
                credits_used: verifyResult[0].credits_used
              }
            });
          }
        } else {
          logger.warn(`🚨 No user found with email: ${email}`);
          return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Processed ${type} event for ${email}`,
        details: simulatedData
      });
      
    } catch (processError: any) {
      logger.error('Error processing test webhook:', { data: { error: processError?.message || String(processError) }});
      return NextResponse.json({ error: `Error processing test webhook: ${processError?.message}` }, { status: 500 });
    }
    
  } catch (error: any) {
    logger.error('Test webhook error:', { data: { error: error?.message || String(error) }});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to determine subscription tier from product ID
function getSubscriptionTier(productId: string): string {
  const PLAN_PRODUCT_IDS = {
    basic: '861cd62e-ceb6-4beb-8c06-43a8652eae8c',
    pro: '4b2f5d5d-cba5-4ec2-b80e-d9053eec75b5',
  };
  
  logger.debug(`Checking product ID for subscription tier`, { data: { productId }});
  
  if (productId === PLAN_PRODUCT_IDS.basic) {
    logger.info('Matched BASIC plan subscription');
    return 'basic';
  }
  if (productId === PLAN_PRODUCT_IDS.pro) {
    logger.info('Matched PRO plan subscription');
    return 'pro';
  }
  
  logger.warn('No subscription tier match found for product ID, defaulting to FREE', { 
    data: { productId } 
  });
  return 'free';
} 