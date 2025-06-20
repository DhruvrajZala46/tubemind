// Test script for payment webhook functionality
const { default: fetch } = require('node-fetch');

// Configuration
const config = {
  baseUrl: 'http://localhost:8000', // Change to your local development URL
  webhookTestUrl: '/api/webhook/test',
  userEmail: process.argv[2], // Pass email as first argument
  productId: process.argv[3] || 'c2dc830c-17d2-436a-aedb-b74c2a79837a' // Pro plan by default, or pass as second argument
};

// Validate inputs
if (!config.userEmail) {
  console.error('❌ Error: Email is required');
  console.log('Usage: node test-payment-webhook.js <email> [productId]');
  console.log('Example: node test-payment-webhook.js user@example.com c2dc830c-17d2-436a-aedb-b74c2a79837a');
  process.exit(1);
}

// Test webhook events
async function testWebhook() {
  console.log('🧪 Testing payment webhook functionality');
  console.log(`📧 Using email: ${config.userEmail}`);
  console.log(`🆔 Using product ID: ${config.productId}`);

  try {
    // Test subscription.created event
    console.log('\n🔄 Testing subscription.created event...');
    const subscriptionResponse = await fetch(`${config.baseUrl}${config.webhookTestUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'subscription.created',
        email: config.userEmail,
        product_id: config.productId
      })
    });

    const subscriptionResult = await subscriptionResponse.json();
    
    if (subscriptionResponse.ok) {
      console.log('✅ Subscription created webhook test successful!');
      console.log('📊 Response:', JSON.stringify(subscriptionResult, null, 2));
    } else {
      console.error('❌ Subscription created webhook test failed!');
      console.error('📊 Error:', JSON.stringify(subscriptionResult, null, 2));
    }

    // Test checkout.updated event
    console.log('\n🔄 Testing checkout.updated event...');
    const checkoutResponse = await fetch(`${config.baseUrl}${config.webhookTestUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'checkout.updated',
        email: config.userEmail,
        product_id: config.productId
      })
    });

    const checkoutResult = await checkoutResponse.json();
    
    if (checkoutResponse.ok) {
      console.log('✅ Checkout updated webhook test successful!');
      console.log('📊 Response:', JSON.stringify(checkoutResult, null, 2));
    } else {
      console.error('❌ Checkout updated webhook test failed!');
      console.error('📊 Error:', JSON.stringify(checkoutResult, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    process.exit(1);
  }
}

// Run the tests
testWebhook().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 