/**
 * Environment Variable Fixer
 * 
 * This script fixes common issues with environment variables in .env.local files:
 * 1. Removes quotes around Redis URLs that can cause connection issues
 * 2. Ensures proper formatting of environment variables
 * 3. Creates a backup of the original .env.local file
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const ENV_FILE = '.env.local';
const BACKUP_SUFFIX = `.backup-${Date.now()}`;

console.log('🔧 Environment Variable Fixer');

// Path to .env.local and dev.env
const envPath = path.join(process.cwd(), ENV_FILE);
const devEnvPath = path.join(process.cwd(), 'dev.env');

// Create .env.local if it doesn't exist by copying from dev.env
if (!fs.existsSync(envPath)) {
  console.log('⚠️ .env.local file not found, creating from dev.env template');
  
  if (!fs.existsSync(devEnvPath)) {
    console.error('❌ dev.env file not found, cannot create .env.local');
    process.exit(1);
  }
  
  // Copy dev.env to .env.local
  fs.copyFileSync(devEnvPath, envPath);
  console.log('✅ Created .env.local from dev.env template');
}

// Read the file
let content = fs.readFileSync(envPath, 'utf8');
let modified = false;

// Check if we're on Windows - Redis often has permission issues on Windows
const isWindows = os.platform() === 'win32';
if (isWindows) {
  console.log('⚠️ Windows environment detected - Redis may have permission issues');
}

// Fix common issues with environment variables
function fixEnvironmentVariables() {
  // Create a backup of the original file
  const backupPath = path.join(process.cwd(), `${ENV_FILE}${BACKUP_SUFFIX}`);
  try {
    fs.writeFileSync(backupPath, content);
    console.log(`📦 Created backup of ${ENV_FILE} at ${backupPath}`);
  } catch (err) {
    console.error(`❌ Could not create backup: ${err.message}`);
    process.exit(1);
  }
  
  // Fix DATABASE_URL quotes
  if (content.includes("DATABASE_URL='") || content.includes('DATABASE_URL="')) {
    console.log('⚠️ DATABASE_URL has quotes that may cause connection issues');
    content = content.replace(/DATABASE_URL=['"](.+?)['"]/, 'DATABASE_URL=$1');
    modified = true;
    console.log('✅ Removed quotes from DATABASE_URL');
  }
  
  // Fix Redis URL quotes
  if (content.includes("REDIS_URL='") || content.includes('REDIS_URL="')) {
    console.log('⚠️ REDIS_URL has quotes that may cause connection issues');
    content = content.replace(/REDIS_URL=['"](.+?)['"]/, 'REDIS_URL=$1');
    modified = true;
    console.log('✅ Removed quotes from REDIS_URL');
  }
  
  // Fix Upstash Redis URL quotes
  if (content.includes("UPSTASH_REDIS_REST_URL='") || content.includes('UPSTASH_REDIS_REST_URL="')) {
    console.log('⚠️ UPSTASH_REDIS_REST_URL has quotes that may cause connection issues');
    content = content.replace(/UPSTASH_REDIS_REST_URL=['"](.+?)['"]/, 'UPSTASH_REDIS_REST_URL=$1');
    modified = true;
    console.log('✅ Removed quotes from UPSTASH_REDIS_REST_URL');
  }
  
  // Fix Upstash Redis token quotes
  if (content.includes("UPSTASH_REDIS_REST_TOKEN='") || content.includes('UPSTASH_REDIS_REST_TOKEN="')) {
    console.log('⚠️ UPSTASH_REDIS_REST_TOKEN has quotes that may cause connection issues');
    content = content.replace(/UPSTASH_REDIS_REST_TOKEN=['"](.+?)['"]/, 'UPSTASH_REDIS_REST_TOKEN=$1');
    modified = true;
    console.log('✅ Removed quotes from UPSTASH_REDIS_REST_TOKEN');
  }
  
  // Check for Redis configuration
  if (content.includes('REDIS_URL=') && !content.includes('DISABLE_REDIS=')) {
    console.log('⚠️ DISABLE_REDIS flag not found, adding it');
    // Add after REDIS_URL
    content = content.replace(
      /REDIS_URL=.+(\r?\n)/,
      (match) => `${match}DISABLE_REDIS=${isWindows ? 'true' : 'false'}\n`
    );
    modified = true;
    console.log(`✅ Added DISABLE_REDIS=${isWindows ? 'true' : 'false'}`);
  }
  
  // If NODE_ENV is not set, add it
  if (!content.includes('NODE_ENV=')) {
    console.log('⚠️ NODE_ENV not found, adding it');
    content = `# Core Configuration\nNODE_ENV=development\n\n${content}`;
    modified = true;
    console.log('✅ Added NODE_ENV=development');
  }
  
  // Save changes if needed
  if (modified) {
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('✅ Updated environment variables in .env.local');
  } else {
    console.log('✅ No issues found in environment variables');
  }
}

// Validate required environment variables
function validateRequiredVariables() {
  const requiredVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'OPENAI_API_KEY',
    'YOUTUBE_API_KEY',
    'POLAR_WEBHOOK_SECRET',
    'POLAR_ACCESS_TOKEN'
  ];
  
  const missingVars = [];
  
  for (const varName of requiredVars) {
    if (!content.includes(`${varName}=`)) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.log('⚠️ Missing required environment variables:');
    missingVars.forEach(varName => console.log(`  - ${varName}`));
    
    // Add missing variables from dev.env if available
    if (fs.existsSync(devEnvPath)) {
      const devEnvContent = fs.readFileSync(devEnvPath, 'utf8');
      let added = false;
      
      for (const varName of missingVars) {
        const match = devEnvContent.match(new RegExp(`${varName}=(.+)(\r?\n)`));
        if (match) {
          content += `\n# Added from dev.env\n${varName}=${match[1]}\n`;
          added = true;
          console.log(`✅ Added ${varName} from dev.env template`);
        }
      }
      
      if (added) {
        fs.writeFileSync(envPath, content, 'utf8');
        modified = true;
      }
    }
  } else {
    console.log('✅ All required environment variables are present');
  }
}

// Run the fixes
fixEnvironmentVariables();
validateRequiredVariables();

console.log('✅ Environment variable fix completed'); 