// Redis Connection Tester and Fixer
// This script tests Redis connectivity and fixes common issues

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const os = require('os');
const { promisify } = require('util');
const { exec } = require('child_process');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const ENV_FILE = '.env.local';
const BACKUP_SUFFIX = `.backup-${Date.now()}`;

console.log('🔍 Redis Connection Tester and Fixer');

// Check if running on Windows
const isWindows = os.platform() === 'win32';
if (isWindows) {
  console.log('⚠️ Windows environment detected - Redis may have permission issues');
}

// Check if Redis is disabled
if (process.env.DISABLE_REDIS === 'true') {
  console.log('⚠️ Redis is currently disabled (DISABLE_REDIS=true)');
}

// Read the environment file
let envContent;
try {
  envContent = fs.readFileSync(ENV_FILE, 'utf8');
} catch (err) {
  console.error(`❌ Could not read ${ENV_FILE}: ${err.message}`);
  process.exit(1);
}

// Test Redis connection
async function testRedisConnection() {
  console.log('🔄 Testing Redis connection...');
  
  // Check if Redis URLs are defined
  if (!process.env.REDIS_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    console.error('❌ No Redis URLs defined in environment variables');
    return false;
  }
  
  // If using Upstash Redis REST API
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log('🔄 Testing Upstash Redis REST API connection...');
    
    try {
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/test-key`, {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
        }
      });
      
      if (response.ok) {
        console.log('✅ Upstash Redis REST API connection successful');
        return true;
      } else {
        console.error(`❌ Upstash Redis REST API connection failed: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (err) {
      console.error(`❌ Upstash Redis REST API connection error: ${err.message}`);
      return false;
    }
  }
  
  // If using standard Redis connection
  if (process.env.REDIS_URL) {
    console.log('🔄 Testing standard Redis connection...');
    
    try {
      // Use redis-cli to test connection
      const execAsync = promisify(exec);
      const result = await execAsync(`echo "PING" | redis-cli -u "${process.env.REDIS_URL}"`);
      
      if (result.stdout.trim() === 'PONG') {
        console.log('✅ Standard Redis connection successful');
        return true;
      } else {
        console.error(`❌ Standard Redis connection failed: ${result.stdout}`);
        return false;
      }
    } catch (err) {
      console.error(`❌ Standard Redis connection error: ${err.message}`);
      return false;
    }
  }
  
  return false;
}

// Fix Redis configuration
function fixRedisConfiguration() {
  console.log('🔄 Fixing Redis configuration...');
  
  // Create a backup
  const backupPath = path.join(process.cwd(), `${ENV_FILE}${BACKUP_SUFFIX}`);
  try {
    fs.writeFileSync(backupPath, envContent);
    console.log(`📦 Created backup of ${ENV_FILE} at ${backupPath}`);
  } catch (err) {
    console.error(`❌ Could not create backup: ${err.message}`);
    process.exit(1);
  }
  
  // Fix common issues
  let fixedContent = envContent;
  let issuesFound = false;
  
  // 1. Fix quoted URLs
  const urlVars = ['REDIS_URL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  urlVars.forEach(varName => {
    // Match the variable with quoted value
    const regex = new RegExp(`${varName}=["']([^"']*)["']`, 'g');
    if (regex.test(fixedContent)) {
      issuesFound = true;
      console.log(`🔄 Removing quotes from ${varName}`);
      fixedContent = fixedContent.replace(regex, `${varName}=$1`);
    }
  });
  
  // 2. Enable Redis
  if (fixedContent.includes('DISABLE_REDIS=true')) {
    issuesFound = true;
    console.log('🔄 Enabling Redis (DISABLE_REDIS=false)');
    fixedContent = fixedContent.replace('DISABLE_REDIS=true', 'DISABLE_REDIS=false');
  }
  
  // Write the fixed content back to the file
  if (issuesFound) {
    try {
      fs.writeFileSync(ENV_FILE, fixedContent);
      console.log(`✅ Fixed Redis configuration saved to ${ENV_FILE}`);
      console.log('⚠️ Please restart your application for changes to take effect');
    } catch (err) {
      console.error(`❌ Could not write fixed content: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log('✅ No Redis configuration issues found');
  }
}

// In-memory fallback recommendation
function recommendInMemoryFallback() {
  console.log('\n📝 Recommendation:');
  console.log('If Redis continues to fail, you can use in-memory processing for development:');
  console.log('1. Set DISABLE_REDIS=true in your .env.local file');
  console.log('2. Use npm run worker to start the worker process');
  console.log('3. This will use in-memory processing instead of Redis');
  console.log('\nFor production, you must fix Redis connectivity issues.');
}

// Main function
async function main() {
  // Test Redis connection
  const redisConnected = await testRedisConnection();
  
  // If Redis connection failed, fix configuration
  if (!redisConnected) {
    console.log('\n⚠️ Redis connection failed. Attempting to fix configuration...');
    fixRedisConfiguration();
    recommendInMemoryFallback();
  } else {
    console.log('\n✅ Redis connection successful. No fixes needed.');
  }
}

// Run the main function
main().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}`);
  process.exit(1);
}); 