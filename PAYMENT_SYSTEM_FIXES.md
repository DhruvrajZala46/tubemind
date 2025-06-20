# Payment System Fixes

This document outlines the fixes applied to the payment system integration with Polar.sh.

## Issues Fixed

1. **Product ID Mismatch**: 
   - There was a mismatch between the product IDs defined in `src/config/plans.ts` and those used in `src/app/api/webhook/route.ts`.
   - The sandbox Pro plan product ID had an extra character at the end.

2. **Success URL Configuration**:
   - The checkout API was using `process.env.SUCCESS_URL` which wasn't properly defined.
   - Updated to use the constants from `plans.ts` (`CHECKOUT_SUCCESS_URL`).

3. **Webhook Handling**:
   - Created a test endpoint (`/api/webhook/test`) to simulate Polar webhooks for testing.
   - This allows testing the subscription update functionality without actual Polar events.

## Testing Tools

1. **Test Script**: 
   - Created `test-payment-webhook.js` to test the webhook functionality.
   - This script simulates both `subscription.created` and `checkout.updated` events.

## How to Test

1. Start the development server:
   ```
   npm run dev
   ```

2. Run the test script with a user's email:
   ```
   node test-payment-webhook.js user@example.com
   ```

3. Verify that the user's subscription tier is updated to "pro" in the database.

## Production Configuration

When moving to production, ensure:

1. Update the product IDs in `PRODUCT_IDS.production` in `src/config/plans.ts` to match your actual Polar product IDs.
2. Set the `POLAR_SERVER` environment variable to "production".
3. Update the `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET` with production values.
4. Test the webhook endpoint with production values before going live.

## Troubleshooting

If payments are not processing correctly:

1. Check the server logs for webhook events.
2. Verify that the product IDs match between your application and Polar.
3. Ensure the webhook URL is correctly set in your Polar dashboard.
4. Test with the webhook test endpoint to verify database updates are working.
5. Check for any errors in the webhook handling code.

## Webhook Event Flow

1. User completes checkout on Polar.
2. Polar sends a `checkout.updated` event to your webhook endpoint.
3. When subscription is created, Polar sends a `subscription.created` event.
4. Your webhook handler updates the user's subscription tier and resets credits.
5. User now has access to the paid plan features. 