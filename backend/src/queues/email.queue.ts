import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { config } from '../config/env';
import { EmailJobData } from '../types';

export const emailQueue = new Queue<EmailJobData>(config.queue.name, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false, // Keep in BullMQ for visibility & dashboard
    removeOnFail: false,
  },
});

emailQueue.on('error', (err) => {
  console.error('[BullMQ Queue] Error:', err.message);
});

console.log(`[BullMQ] Initialized Queue: "${config.queue.name}"`);
