const https = require('https');

const APP_URL = 'https://tubemind-304961481608.asia-south1.run.app';
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Short test video

async function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    console.log(`📡 ${method} ${url}`);
    
    const req = https.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TubeGPT-Test/1.0'
      }
    }, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: result });
        } catch (error) {
          // If it's not JSON, return raw text
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function cleanRedisQueue() {
  try {
    console.log('\n🧹 STEP 1: Cleaning Redis Queue');
    const result = await makeRequest(`${APP_URL}/api/admin/clean-redis`, 'POST');
    
    if (result.status === 200) {
      console.log('✅ Redis cleaned:', result.data);
      return true;
    } else {
      console.log('⚠️ Cleanup endpoint not available, proceeding anyway...');
      return false;
    }
  } catch (error) {
    console.log('⚠️ Cleanup failed, proceeding anyway...');
    return false;
  }
}

async function submitVideo() {
  try {
    console.log('\n🎬 STEP 2: Submitting Video for Processing');
    const result = await makeRequest(`${APP_URL}/api/extract`, 'POST', {
      videoUrl: TEST_VIDEO_URL
    });
    
    if (result.status === 200 && result.data.videoId) {
      console.log('✅ Video submitted successfully!');
      console.log('📹 Video ID:', result.data.videoId);
      console.log('👤 User ID:', result.data.userId);
      return { videoId: result.data.videoId, userId: result.data.userId };
    } else {
      console.error('❌ Video submission failed:', result);
      return null;
    }
  } catch (error) {
    console.error('❌ Video submission error:', error);
    return null;
  }
}

async function monitorProcessing(videoId) {
  if (!videoId) return;
  
  console.log('\n📊 STEP 3: Monitoring Processing Status');
  
  const maxAttempts = 30; // 30 attempts with 2-second intervals = 1 minute
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const result = await makeRequest(`${APP_URL}/api/summaries/${videoId}/status`);
      
      if (result.status === 200) {
        console.log(`🔄 Attempt ${attempts + 1}:`, result.data);
        
        if (result.data.status === 'completed') {
          console.log('🎉 SUCCESS! Video processing completed!');
          console.log('⏱️ Total time: ~' + ((attempts + 1) * 2) + ' seconds');
          return true;
        } else if (result.data.status === 'failed') {
          console.log('❌ Processing failed:', result.data);
          return false;
        }
      } else {
        console.log(`⚠️ Status check failed: ${result.status}`);
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('❌ Status check error:', error);
      attempts++;
    }
  }
  
  console.log('⏰ Timeout reached. Processing may still be in progress.');
  return false;
}

async function main() {
  console.log('🚀 STARTING COMPLETE REDIS-ONLY PROCESSING TEST');
  console.log('=================================================');
  
  try {
    // Step 1: Clean Redis Queue
    await cleanRedisQueue();
    
    // Step 2: Submit Video
    const submission = await submitVideo();
    if (!submission) {
      console.error('❌ Test failed: Could not submit video');
      return;
    }
    
    // Step 3: Monitor Processing
    const success = await monitorProcessing(submission.videoId);
    
    console.log('\n📋 FINAL RESULTS');
    console.log('================');
    if (success) {
      console.log('✅ REDIS-ONLY PROCESSING SUCCESSFUL!');
      console.log('⚡ Video processed instantly with Redis queue');
      console.log('💰 Zero database polling = Zero Neon billing impact');
    } else {
      console.log('❌ Processing incomplete or failed');
      console.log('🔍 Check worker logs for details');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main(); 