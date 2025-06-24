const { CloudTasksClient } = require('@google-cloud/tasks');

async function testCloudTasks() {
  try {
    console.log('🧪 Testing Cloud Tasks integration...');
    
    const client = new CloudTasksClient();
    const project = 'agile-entry-463508-u6';
    const queue = 'video-processing-queue';
    const location = 'us-central1';
    const workerUrl = 'https://tubemind-worker-304961481608.us-central1.run.app';
    
    // Test queue exists
    const queuePath = client.queuePath(project, location, queue);
    console.log(`📋 Queue path: ${queuePath}`);
    
    // Test creating a simple task
    const testJobData = {
      videoId: 'test123',
      userId: 'test-user',
      message: 'Test task from Cloud Tasks integration'
    };
    
    const task = {
      httpRequest: {
        httpMethod: 'POST',
        url: workerUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify(testJobData)).toString('base64'),
      },
    };
    
    console.log('🚀 Creating test task...');
    const request = { parent: queuePath, task: task };
    const [response] = await client.createTask(request);
    
    console.log('✅ Test task created successfully!');
    console.log(`Task name: ${response.name}`);
    
    // Test worker endpoint
    console.log('🔍 Testing worker endpoint...');
    const fetch = (await import('node-fetch')).default;
    
    const healthResponse = await fetch(`${workerUrl}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Worker health check passed:', healthData);
    } else {
      console.log('❌ Worker health check failed:', healthResponse.status);
    }
    
    console.log('\n🎉 Cloud Tasks integration test completed!');
    console.log('\n📋 Summary:');
    console.log(`  Project: ${project}`);
    console.log(`  Queue: ${queue}`);
    console.log(`  Location: ${location}`);
    console.log(`  Worker URL: ${workerUrl}`);
    console.log('\n💡 If this test passed, your video processing should work after adding environment variables to Vercel.');
    
  } catch (error) {
    console.error('❌ Cloud Tasks test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure you have the right Google Cloud credentials');
    console.log('2. Check if the queue exists: gcloud tasks queues list --location=us-central1');
    console.log('3. Verify worker is running: curl https://tubemind-worker-304961481608.us-central1.run.app/health');
  }
}

testCloudTasks(); 