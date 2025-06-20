import { NextRequest, NextResponse } from 'next/server';
import { Polar } from '@polar-sh/sdk';
import { createLogger } from '../../../lib/logger';
import { currentUser } from '@clerk/nextjs/server';
import { CHECKOUT_SUCCESS_URL, CHECKOUT_CANCEL_URL, PRODUCT_IDS } from '../../../config/plans';

const logger = createLogger('payment:checkout');

// NOTE: Product IDs for plans are set in src/config/plans.ts. Update them there if you change plans in Polar.

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId');

  logger.info('Checkout API called', { data: { productId } });

  if (!productId) {
    logger.warn('Missing productId parameter');
    return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
  }

  try {
    // Get user info for better logging and metadata
    const user = await currentUser();
    const userId = user?.id;
    const userEmail = user?.emailAddresses[0]?.emailAddress;

    // Require authentication for checkout
    if (!userId || !userEmail) {
      logger.warn('User not authenticated for checkout');
      return NextResponse.json({ error: 'You must be signed in to purchase a plan.' }, { status: 401 });
    }

    // Verify the product ID is valid in our system
    const environment = process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox';
    const validProductIds = [
      PRODUCT_IDS[environment].basic,
      PRODUCT_IDS[environment].pro
    ];

    if (!validProductIds.includes(productId)) {
      logger.warn('Invalid product ID', { 
        data: { 
          productId, 
          validProductIds,
          environment
        } 
      });
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    logger.info('Processing checkout', {
      userId,
      email: userEmail,
      data: {
        productId,
        server: process.env.POLAR_SERVER
      }
    });

    // Initialize Polar SDK with proper error handling
    let polar;
    try {
      polar = new Polar({
        accessToken: process.env.POLAR_ACCESS_TOKEN!,
        server: process.env.POLAR_SERVER === 'sandbox' ? 'sandbox' : 'production'
      });
      logger.debug('Initialized Polar SDK', { userId });
    } catch (initError: any) {
      logger.error('Failed to initialize Polar SDK', {
        data: {
          error: initError?.message || String(initError),
          stack: initError?.stack
        }
      });
      return NextResponse.json({ 
        error: 'Payment service initialization failed. Please try again later.' 
      }, { status: 500 });
    }

    // Create checkout with retry logic for 502 errors
    let checkout;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // Use products array and pass user metadata for reconciliation
        checkout = await polar.checkouts.create({
          products: [productId],
          metadata: {
            userId,
            userEmail
          },
          successUrl: CHECKOUT_SUCCESS_URL
        });
        
        // If successful, break out of retry loop
        break;
      } catch (checkoutError: any) {
        attempts++;
        
        // Log the error details
        logger.error(`Polar checkout error (attempt ${attempts}/${maxAttempts})`, {
          data: {
            error: checkoutError?.message || String(checkoutError),
            status: checkoutError?.response?.status,
            statusText: checkoutError?.response?.statusText,
            productId
          }
        });
        
        // If it's a 502 Bad Gateway and we haven't reached max attempts, retry
        if ((checkoutError?.response?.status === 502 || 
             checkoutError?.message?.includes('502') || 
             checkoutError?.message?.includes('Bad Gateway')) && 
            attempts < maxAttempts) {
          
          logger.info(`Retrying checkout after 502 error (attempt ${attempts}/${maxAttempts})`);
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          continue;
        }
        
        // For other errors or if we've reached max attempts, return error to client
        return NextResponse.json({ 
          error: 'Unable to create checkout session. Please try again later.',
          details: checkoutError?.message || 'Payment gateway error'
        }, { status: 500 });
      }
    }

    // If we got here without a checkout object, something went wrong
    if (!checkout) {
      logger.error('Failed to create checkout after multiple attempts', {
        data: { productId, attempts }
      });
      return NextResponse.json({ 
        error: 'Unable to create checkout session after multiple attempts. Please try again later.' 
      }, { status: 500 });
    }

    logger.info('Checkout created successfully', {
      userId,
      data: {
        checkoutId: checkout.id,
        checkoutUrl: checkout.url
      }
    });

    // Record checkout attempt in database for tracking
    try {
      // This could be implemented if you want to track checkout attempts
      // await recordCheckoutAttempt(userId, userEmail, productId, checkout.id);
    } catch (recordError) {
      // Non-blocking error - just log it
      logger.warn('Failed to record checkout attempt', { data: { error: recordError }});
    }

    return NextResponse.redirect(checkout.url);
  } catch (err: any) {
    logger.error('Polar SDK error', {
      data: {
        error: err.message,
        productId
      }
    });

    // Return a user-friendly error
    return NextResponse.json({ 
      error: 'Unable to process your payment request. Please try again later.' 
    }, { status: 400 });
  }
}