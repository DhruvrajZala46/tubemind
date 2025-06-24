import { CloudTasksClient, protos } from '@google-cloud/tasks';

const client = new CloudTasksClient();

export async function enqueueJob(jobData: any) {
  const project = process.env.GCP_PROJECT!;
  const queue = process.env.CLOUD_TASKS_QUEUE!;
  const location = process.env.CLOUD_TASKS_LOCATION!;
  const url = process.env.WORKER_URL!; // Cloud Run worker endpoint

  const parent = client.queuePath(project, location, queue);
  const task = {
    httpRequest: {
      httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST, // <--- FIXED
      url,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify(jobData)).toString('base64'),
    },
  };
  await client.createTask({ parent, task });
}