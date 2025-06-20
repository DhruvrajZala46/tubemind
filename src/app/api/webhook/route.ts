import { NextRequest, NextResponse } from 'next/server';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../lib/logger';
import env from '../../../lib/env';

const sql = neon(env.DATABASE_URL);
const logger = createLogger('payment:webhook');

// Your actual product IDs from your Polar dashboard
const PLAN_PRODUCT_IDS = {
  basic: '5ee6ffad-ea07-47bf-8219-ad7b77ce4e3f',
  pro: 'a0cb28d8-e607-4063-b3ea-c753178bbf53',
};

function getSubscriptionTier(productId: string): string {
  logger.debug(`Checking product ID for subscription tier`, { data: { productId }});
  logger.debug(`Product ID references`, { data: { 
    basic: PLAN_PRODUCT_IDS.basic, 
    pro: PLAN_PRODUCT_IDS.pro 
  }});
  
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

// Add a helper to log failed webhook events for admin review and retry
async function logFailedWebhook(eventType: string, eventData: any, error: any) {
  try {
    await sql`
      INSERT INTO failed_webhooks (event_type, event_data, error_message, created_at)
      VALUES (${eventType}, ${JSON.stringify(eventData)}, ${error?.message || String(error)}, NOW())
    `;
    logger.info(`Failed webhook logged for later retry: ${eventType}`);
  } catch (logError: any) {
    logger.error('Failed to log failed webhook event', { data: { logError: logError?.message || String(logError) } });
  }
}

// Implement idempotency to prevent duplicate processing
async function checkIdempotencyKey(idempotencyKey: string): Promise<boolean> {
  try {
    // Check if this webhook has already been processed
    const result = await sql`
      SELECT id FROM webhook_events WHERE idempotency_key = ${idempotencyKey} LIMIT 1
    `;
    
    if (result && result.length > 0) {
      logger.info(`Webhook with idempotency key ${idempotencyKey} already processed, skipping`);
      return true; // Already processed
    }
    
    // Record this webhook to prevent duplicate processing
    await sql`
      INSERT INTO webhook_events (idempotency_key, created_at) 
      VALUES (${idempotencyKey}, NOW())
    `;
    
    return false; // Not processed before
  } catch (error: any) {
    // If webhook_events table doesn't exist, create it and continue
    if (error?.message?.includes('relation "webhook_events" does not exist')) {
      logger.warn('webhook_events table does not exist, creating it');
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS webhook_events (
            id SERIAL PRIMARY KEY,
            idempotency_key VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `;
        logger.info('✅ webhook_events table created');
        
        // Now try to insert the record
        await sql`
          INSERT INTO webhook_events (idempotency_key, created_at) 
          VALUES (${idempotencyKey}, NOW())
        `;
        return false; // Not processed before
      } catch (createError: any) {
        logger.error('Failed to create webhook_events table', { data: { error: createError?.message }});
        return false; // Proceed with processing to be safe
      }
    }
    
    logger.error('Error checking idempotency key', { data: { error: error?.message || String(error) } });
    return false; // Proceed with processing to be safe
  }
}

export async function POST(request: NextRequest) {
  logger.info('Webhook request received');

  try {
    // Parse webhook request body
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    // Debug: Log all headers to see what Polar is actually sending
    logger.debug('Received headers from Polar:', { data: { headers } });
    
    // Accept **only** the canonical header to prevent header-spoofing attacks.
    const signatureHeader = headers['webhook-signature'];
    
    if (!signatureHeader) {
      logger.error('Missing webhook signature header - available headers:', { 
        data: { 
          availableHeaders: Object.keys(headers),
          headerCount: Object.keys(headers).length
        }
      });
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    logger.debug('Found signature header, validating webhook signature', {
      data: { headerUsed: 'found' }
    });
    
    let event;
    try {
      // Validate webhook signature using Polar's SDK
      event = validateEvent(body, headers, process.env.POLAR_WEBHOOK_SECRET!);
    } catch (err) {
      if ((err as any) instanceof WebhookVerificationError) {
        logger.error('Webhook signature verification failed', { data: { error: (err as any).message } });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
      logger.error('Webhook validation error', { data: { error: err } });
      return NextResponse.json({ error: 'Webhook validation error' }, { status: 400 });
    }

    logger.info(`Webhook event received: ${event.type}`, { 
      data: { 
        eventType: event.type,
        eventData: event.data ? JSON.stringify(event.data).substring(0, 100) + '...' : {}
      }
    });

    // Check for idempotency to prevent duplicate processing
    const idempotencyKey = `${event.type}_${event.data?.id || 'unknown'}_${Date.now()}`;
    const alreadyProcessed = await checkIdempotencyKey(idempotencyKey);
    
    if (alreadyProcessed) {
      logger.info(`Webhook already processed, returning success`);
      return NextResponse.json({ received: true, status: 'already_processed' }, { status: 200 });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.created':
        logger.info('Checkout created', { data: { checkoutId: event.data.id }});
        break;

      case 'checkout.updated':
        logger.info('Checkout updated', { 
          data: { 
            checkoutId: event.data.id, 
            status: event.data.status
          }
        });
        
        if (event.data.status === 'confirmed') {
          logger.info('Checkout confirmed, processing subscription', { 
            data: { checkoutId: event.data.id }
          });
          try {
            await handleSuccessfulCheckout(event.data);
          } catch (err) {
            await logFailedWebhook('checkout.updated', event.data, err);
            throw err;
          }
        } else if (event.data.status === 'succeeded') {
          logger.info('Checkout succeeded, ensuring subscription is active', {
            data: { checkoutId: event.data.id }
          });
          // No additional action needed as subscription.created handles the actual subscription
        }
        break;

      case 'subscription.created':
        logger.info('Subscription created', { data: { subscriptionId: event.data.id }});
        try {
          await handleSubscriptionCreated(event.data);
        } catch (err) {
          await logFailedWebhook('subscription.created', event.data, err);
          throw err;
        }
        break;

      case 'subscription.updated':
        logger.info('Subscription updated', { data: { subscriptionId: event.data.id }});
        try {
          await handleSubscriptionUpdated(event.data);
        } catch (err) {
          await logFailedWebhook('subscription.updated', event.data, err);
          throw err;
        }
        break;

      case 'subscription.canceled':
        logger.info('Subscription canceled', { data: { subscriptionId: event.data.id }});
        try {
          await handleSubscriptionCanceled(event.data);
        } catch (err) {
          await logFailedWebhook('subscription.canceled', event.data, err);
          throw err;
        }
        break;

      case 'subscription.revoked':
        logger.info('Subscription revoked', { data: { subscriptionId: event.data.id }});
        try {
          await handleSubscriptionRevoked(event.data);
        } catch (err) {
          await logFailedWebhook('subscription.revoked', event.data, err);
          throw err;
        }
        break;

      case 'order.created':
      case 'order.paid':
      case 'order.updated':
        logger.info(`Order event: ${event.type}`, { data: { orderId: event.data.id }});
        // Handle order events if needed
        break;

      default:
        logger.warn(`Unhandled event type: ${event.type}`);
        // Note: Refunds and chargebacks are typically handled through Polar's dashboard
        // and don't require immediate subscription changes in most SaaS models
    }

    logger.info('Webhook processed successfully');
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    logger.error('Webhook error', { data: { error: error?.message || String(error) }});
    // Log the failed webhook for admin review
    try {
      await logFailedWebhook('webhook.error', {}, error);
    } catch (logError) {
      logger.error('Failed to log webhook error', { data: { error: logError }});
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleSuccessfulCheckout(checkoutData: any) {
  try {
    // Extract customer email from checkout data
    const customerEmail = checkoutData.customer_email || checkoutData.customerEmail;
    const productId = checkoutData.product_id || checkoutData.productId;
    
    if (!customerEmail) {
      logger.error('No customer email in checkout data', { data: { checkoutData: JSON.stringify(checkoutData).substring(0, 200) }});
      return;
    }

    const tier = getSubscriptionTier(productId);
    logger.info(`Processing checkout for email: ${customerEmail}, tier: ${tier}`);
    
    // Get the appropriate credit limit for the tier
    const creditLimits = {
      free: 60,
      basic: 1800, // 1 hr/day * 30 days
      pro: 6000    // 3 hr/day * 30 days
    };
    
    const creditLimit = creditLimits[tier as keyof typeof creditLimits] || 60;
    
    // Try to update by email first
    const updateByEmailResult = await sql`
      UPDATE users 
      SET 
        subscription_tier = ${tier},
        subscription_status = 'active',
        subscription_id = ${checkoutData.subscription_id || null},
        credits_used = 0,
        last_credit_reset = NOW(),
        updated_at = NOW()
      WHERE email = ${customerEmail}
      RETURNING id, email, subscription_tier
    `;

    if (updateByEmailResult.length > 0) {
      logger.info(`✅ Updated existing user by email: ${customerEmail} to ${tier}`, {
        data: { 
          userId: updateByEmailResult[0].id, 
          newTier: tier,
          creditLimit: creditLimit
        }
      });
      
      // Verify the update was successful
      const verifyResult = await sql`
        SELECT subscription_tier, subscription_status, credits_used 
        FROM users 
        WHERE email = ${customerEmail}
      `;
      
      if (verifyResult.length > 0) {
        logger.info(`✅ Verification: User ${customerEmail} now has tier: ${verifyResult[0].subscription_tier}, status: ${verifyResult[0].subscription_status}`);
      }
      
      return;
    }

    // If no user found, log and exit – no risky fallback updates.
    logger.warn(`🚨 Webhook: No matching user for email ${customerEmail}. Manual review required.`);
    return;
    
  } catch (error: any) {
    logger.error('❌ Error handling successful checkout:', { data: { error: error?.message || String(error) }});
    throw error; // Re-throw for proper error handling
  }
}

async function handleSubscriptionCreated(subscriptionData: any) {
  try {
    const customerEmail = subscriptionData.customer?.email;
    const productId = subscriptionData.product_id || subscriptionData.productId;
    
    if (!customerEmail) {
      logger.error('No customer email in subscription data', { data: { subscriptionData: JSON.stringify(subscriptionData).substring(0, 200) }});
      return;
    }

    const tier = getSubscriptionTier(productId);
    
    // Get the appropriate credit limit for the tier
    const creditLimits = {
      free: 60,
      basic: 1800, // 1 hr/day * 30 days
      pro: 6000    // 3 hr/day * 30 days
    };
    
    const creditLimit = creditLimits[tier as keyof typeof creditLimits] || 60;
    
    // Update user subscription details
    const updateResult = await sql`
      UPDATE users 
      SET 
        subscription_tier = ${tier},
        subscription_status = 'active',
        subscription_id = ${subscriptionData.id},
        subscription_end_date = ${subscriptionData.current_period_end || subscriptionData.currentPeriodEnd},
        credits_used = 0,
        last_credit_reset = NOW(),
        updated_at = NOW()
      WHERE email = ${customerEmail}
      RETURNING id, email, subscription_tier
    `;
    
    if (updateResult.length > 0) {
      logger.info(`✅ Subscription created for user: ${customerEmail} with tier: ${tier}`, {
        data: { 
          userId: updateResult[0].id, 
          subscriptionId: subscriptionData.id,
          creditLimit: creditLimit
        }
      });
      
      // Verify the update was successful
      const verifyResult = await sql`
        SELECT subscription_tier, subscription_status, credits_used 
        FROM users 
        WHERE email = ${customerEmail}
      `;
      
      if (verifyResult.length > 0) {
        logger.info(`✅ Verification: User ${customerEmail} now has tier: ${verifyResult[0].subscription_tier}, status: ${verifyResult[0].subscription_status}`);
      }
    } else {
      logger.warn(`🚨 No user found for subscription creation with email: ${customerEmail}`);
    }
  } catch (error: any) {
    logger.error('❌ Error handling subscription created:', { data: { error: error?.message || String(error) }});
    throw error; // Re-throw for proper error handling
  }
}

async function handleSubscriptionUpdated(subscriptionData: any) {
  try {
    const subscriptionId = subscriptionData.id;
    const status = subscriptionData.status;
    
    console.log(`Subscription updated: ${subscriptionId} status: ${status}`);
    
    // Only update if we have a subscription ID
    if (!subscriptionId) {
      logger.error('Missing subscription ID in update data');
      return;
    }
    
    // Update subscription status in our database
    const updateResult = await sql`
      UPDATE users
      SET 
        subscription_status = ${status},
        subscription_end_date = ${subscriptionData.current_period_end || subscriptionData.currentPeriodEnd},
        updated_at = NOW()
      WHERE subscription_id = ${subscriptionId}
      RETURNING id
    `;
    
    if (updateResult.length === 0) {
      logger.warn(`No user found with subscription ID: ${subscriptionId}`);
    }
  } catch (error: any) {
    logger.error('Error handling subscription update:', { data: { error: error?.message || String(error) }});
    throw error;
  }
}

async function handleSubscriptionCanceled(subscriptionData: any) {
  try {
    const subscriptionId = subscriptionData.id;
    
    // Mark subscription as canceled but don't downgrade until end date
    const updateResult = await sql`
      UPDATE users
      SET 
        subscription_status = 'canceled',
        updated_at = NOW()
      WHERE subscription_id = ${subscriptionId}
      RETURNING id
    `;
    
    if (updateResult.length === 0) {
      logger.warn(`No user found with subscription ID: ${subscriptionId} for cancellation`);
    }
  } catch (error: any) {
    logger.error('Error handling subscription cancellation:', { data: { error: error?.message || String(error) }});
    throw error;
  }
}

async function handleSubscriptionRevoked(subscriptionData: any) {
  try {
    const subscriptionId = subscriptionData.id;
    
    // Immediately downgrade user to free tier
    const updateResult = await sql`
      UPDATE users
      SET 
        subscription_tier = 'free',
        subscription_status = 'inactive',
        updated_at = NOW()
      WHERE subscription_id = ${subscriptionId}
      RETURNING id
    `;
    
    if (updateResult.length === 0) {
      logger.warn(`No user found with subscription ID: ${subscriptionId} for revocation`);
    }
  } catch (error: any) {
    logger.error('Error handling subscription revocation:', { data: { error: error?.message || String(error) }});
    throw error;
  }
} 