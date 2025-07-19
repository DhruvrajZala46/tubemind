// Simple script to fix corrupted credits
const https = require('https');

const options = {
  hostname: 'www.tubemind.live',
  port: 443,
  path: '/api/admin/clean-credits',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

console.log('🔧 Calling credit cleanup endpoint...');

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ Credit cleanup result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Failed to parse response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.end(); 