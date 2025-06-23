const https = require('https');

const APP_URL = 'https://tubemind-304961481608.asia-south1.run.app';

async function cleanRedisQueue() {
  return new Promise((resolve, reject) => {
    const url = `${APP_URL}/api/admin/clean-redis`;
    
    console.log('🧹 Calling Redis cleanup endpoint...');
    console.log('🔗 URL:', url);
    
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Cleanup response:', result);
          resolve(result);
        } catch (error) {
          console.error('❌ Failed to parse response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
      reject(error);
    });
    
    req.end();
  });
}

async function main() {
  try {
    console.log('🚀 Starting Redis queue cleanup...');
    const result = await cleanRedisQueue();
    
    if (result.success) {
      console.log('✅ SUCCESS! Redis queue cleaned successfully');
      console.log(`📊 Items removed: ${result.itemsRemoved}`);
      console.log(`📊 Final queue length: ${result.finalQueueLength}`);
    } else {
      console.error('❌ Cleanup failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

main(); 