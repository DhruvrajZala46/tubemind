// Test Worker Script
// This script sets dummy environment variables and runs the worker for testing

// Set required environment variables
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgresql://test:test@test.neon.tech/test?sslmode=require';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder_key';
process.env.CLERK_SECRET_KEY = 'sk_test_placeholder_key';
process.env.OPENAI_API_KEY = 'sk-placeholder_key';
process.env.LEAPCELL = 'true';
process.env.DEPLOYMENT_ENV = 'leapcell';

console.log('Starting worker in test mode with dummy environment variables...');

// Use child_process to run the worker
const { exec } = require('child_process');
const worker = exec('npm run worker', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});

console.log('Worker process started. Press Ctrl+C to exit.'); 