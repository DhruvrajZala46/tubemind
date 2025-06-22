import { NextRequest, NextResponse } from 'next/server';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { neon } from '@neondatabase/serverless';
import { createLogger } from '../../../lib/logger';
import env from '../../../lib/env';
import { getPlanByProductId, PLAN_LIMITS, getProductIds } from '../../../config/plans';

const sql = neon(env.DATABASE_URL);
const logger = createLogger('payment:webhook');

// Use product IDs from config/plans.ts for the current environment
const currentProductIds = getProductIds();

function getSubscriptionTier(productId: string): string {
  logger.debug(`Checking product ID for subscription tier`, { data: { productId }});
  logger.debug(`Product ID references`, { data: currentProductIds });
  if (productId === currentProductIds.basic) {
    logger.info('Matched BASIC plan subscription');
    return 'basic';
  }
  if (productId === currentProductIds.pro) {
    logger.info('Matched PRO plan subscription');
    return 'pro';
  }
  logger.warn('No subscription tier match found for product ID, defaulting to FREE', { data: { productId } });
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
    const idempotencyKey = `${event.type}_${event.data?.id || 'unknown'}`;
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
    // Extract customer email and userId from checkout data
    const customerEmail = checkoutData.customer_email || checkoutData.customerEmail;
    const userId = checkoutData.user_id || checkoutData.userId;
    const productId = checkoutData.product_id || checkoutData.productId;
    
    if (!customerEmail && !userId) {
      logger.error('No customer email or userId in checkout data', { data: { checkoutData: JSON.stringify(checkoutData).substring(0, 200) }});
      return;
    }

    const tier = getSubscriptionTier(productId);
    logger.info(`Processing checkout for user: ${userId || customerEmail}, tier: ${tier}`);
    const creditLimit = PLAN_LIMITS[tier as keyof typeof PLAN_LIMITS]?.creditsPerMonth || 60;
    const emailLower = customerEmail ? customerEmail.toLowerCase() : undefined;

    // Try to find user by userId first, then by email
    let userRow = null;
    if (userId) {
      const userResult = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (userResult.length > 0) userRow = userResult[0];
    }
    if (!userRow && emailLower) {
      const userResult = await sql`SELECT * FROM users WHERE LOWER(email) = ${emailLower}`;
      if (userResult.length > 0) userRow = userResult[0];
    }
    if (!userRow) {
      logger.warn(`🚨 Webhook: No matching user for userId/email ${userId || emailLower}. Manual review required.`);
      return;
    }

    // Only update if the user's current plan/status/credits are not already correct
    if (
      userRow.subscription_tier === tier &&
      userRow.subscription_status === 'active' &&
      userRow.credits_limit === creditLimit &&
      userRow.credits_used === 0
    ) {
      logger.info(`User ${userRow.id} already has correct plan/status/credits. Skipping update.`);
      return;
    }

    // Update user by id
    const updateResult = await sql`
      UPDATE users 
      SET 
        subscription_tier = ${tier},
        subscription_status = 'active',
        subscription_id = ${checkoutData.subscription_id || null},
        credits_used = 0,
        credits_limit = ${creditLimit},
        last_credit_reset = NOW(),
        updated_at = NOW()
      WHERE id = ${userRow.id}
      RETURNING id, email, subscription_tier
    `;
    if (updateResult.length > 0) {
      logger.info(`✅ Updated user ${userRow.id} to ${tier}`, {
        data: { userId: updateResult[0].id, newTier: tier, creditLimit: creditLimit }
      });
      
      // Verify the update was successful
      const verifyResult = await sql`
        SELECT subscription_tier, subscription_status, credits_used, credits_limit 
        FROM users 
        WHERE LOWER(email) = ${emailLower}
      `;
      
      if (verifyResult.length > 0) {
        logger.info(`✅ Verification: User ${userRow.email} now has tier: ${verifyResult[0].subscription_tier}, status: ${verifyResult[0].subscription_status}`);
      }
    }
  } catch (error: any) {
    logger.error('❌ Error handling successful checkout:', { data: { error: error?.message || String(error) }});
    throw error; // Re-throw for proper error handling
  }
}

async function handleSubscriptionCreated(subscriptionData: any) {
  try {
    const customerEmail = subscriptionData.customer?.email;
    const userId = subscriptionData.user_id || subscriptionData.userId;
    const productId = subscriptionData.product_id || subscriptionData.productId;
    if (!customerEmail && !userId) {
      logger.error('No customer email or userId in subscription data', { data: { subscriptionData: JSON.stringify(subscriptionData).substring(0, 200) }});
      return;
    }
    const tier = getSubscriptionTier(productId);
    const creditLimit = PLAN_LIMITS[tier as keyof typeof PLAN_LIMITS]?.creditsPerMonth || 60;
    const emailLower = customerEmail ? customerEmail.toLowerCase() : undefined;
    // Try to find user by userId first, then by email
    let userRow = null;
    if (userId) {
      const userResult = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (userResult.length > 0) userRow = userResult[0];
    }
    if (!userRow && emailLower) {
      const userResult = await sql`SELECT * FROM users WHERE LOWER(email) = ${emailLower}`;
      if (userResult.length > 0) userRow = userResult[0];
    }
    if (!userRow) {
      logger.warn(`🚨 No user found for subscription creation with userId/email: ${userId || emailLower}`);
      return;
    }
    // Only update if the user's current plan/status/credits are not already correct
    if (
      userRow.subscription_tier === tier &&
      userRow.subscription_status === 'active' &&
      userRow.credits_limit === creditLimit &&
      userRow.credits_used === 0
    ) {
      logger.info(`User ${userRow.id} already has correct plan/status/credits. Skipping update.`);
      return;
    }
    // Update user by id
    const updateResult = await sql`
      UPDATE users 
      SET 
        subscription_tier = ${tier},
        subscription_status = 'active',
        subscription_id = ${subscriptionData.id},
        subscription_end_date = ${subscriptionData.current_period_end || subscriptionData.currentPeriodEnd},
        credits_used = 0,
        credits_limit = ${creditLimit},
        last_credit_reset = NOW(),
        updated_at = NOW()
      WHERE id = ${userRow.id}
      RETURNING id, email, subscription_tier
    `;
    if (updateResult.length > 0) {
      logger.info(`✅ Subscription created for user: ${userRow.email} with tier: ${tier}`, {
        data: { userId: updateResult[0].id, subscriptionId: subscriptionData.id, creditLimit: creditLimit }
      });
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