const fetch = require('node-fetch');

async function testDirectWorkerCall() {
  const workerUrl = 'https://tubemind-worker-304961481608.us-central1.run.app';
  
  console.log('🧪 Testing direct worker call...');
  
  // Test health endpoint first
  try {
    const healthResponse = await fetch(`${workerUrl}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Worker health check passed:', healthData);
    } else {
      console.log('❌ Worker health check failed:', healthResponse.status);
      return;
    }
  } catch (error) {
    console.error('❌ Worker health check error:', error.message);
    return;
  }
  
  // Test job processing endpoint
  const testJobData = {
    videoId: 'test123',
    videoDbId: 'test-db-id',
    summaryDbId: 'test-summary-id',
    userId: 'test-user',
    userEmail: 'test@example.com',
    user: { id: 'test-user', email: 'test@example.com' },
    metadata: { title: 'Test Video', duration: 120 },
    totalDurationSeconds: 120,
    creditsNeeded: 2,
    youtubeUrl: 'https://youtube.com/watch?v=test123'
  };
  
  try {
    console.log('🚀 Testing job processing...');
    
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testJobData),
    });
    
    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);
    console.log(`Response body: ${responseText}`);
    
    if (response.ok) {
      console.log('✅ Direct worker call test PASSED!');
      console.log('🎉 Your video processing should now work on Vercel!');
    } else {
      console.log('⚠️ Worker responded but with error status');
      console.log('This might be expected for test data without real video info');
    }
    
  } catch (error) {
    console.error('❌ Direct worker call failed:', error.message);
  }
}

testDirectWorkerCall(); 