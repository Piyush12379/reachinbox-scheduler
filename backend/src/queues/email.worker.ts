import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { config } from '../config/env';
import { EmailJobData } from '../types';
import { prisma } from '../db/prisma';
import { emailService } from '../services/email.service';
import { rateLimiterService } from '../services/rate-limiter.service';
import { slackService } from '../services/slack.service';
import { searchService } from '../services/search.service';
import { emailQueue } from './email.queue';

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    config.queue.name,
    async (job: Job<EmailJobData>) => {
      const { dbJobId, sender, recipient, subject, body, hourlyLimit, minDelayMs } = job.data;
      console.log(`\n[Worker] Processing Job ID: ${job.id} | DB ID: ${dbJobId} | To: ${recipient}`);

      // 1. Idempotency Check in DB
      const existingRecord = await prisma.emailJob.findUnique({
        where: { id: dbJobId },
      });

      if (!existingRecord) {
        console.warn(`[Worker] DB record ${dbJobId} not found. Skipping.`);
        return { status: 'skipped_not_found' };
      }

      if (existingRecord.status === 'SENT') {
        console.log(`[Worker] Idempotency guard: Job ${dbJobId} has already been sent at ${existingRecord.sentAt}. Skipping duplicate.`);
        return { status: 'already_sent' };
      }

      // 2. Rate Limiting Check (Redis-backed hourly window)
      const rateCheck = await rateLimiterService.checkAndConsume(sender, hourlyLimit);

      if (!rateCheck.allowed) {
        console.warn(`[Worker] ⚠️ RATE LIMIT REACHED for sender ${sender} (${rateCheck.currentCount}/${rateCheck.maxLimit})!`);
        console.warn(`[Worker] Delaying job until next hourly window (${rateCheck.delayUntilNextWindowMs}ms / at ${rateCheck.nextWindowStartTime.toISOString()})`);

        // Trigger Live Slack Alert
        await slackService.sendRateLimitAlert({
          sender,
          currentCount: rateCheck.currentCount,
          maxLimit: rateCheck.maxLimit,
          rescheduledTime: rateCheck.nextWindowStartTime,
          recipient,
          subject,
        });

        // Reschedule in BullMQ with delay to the next hour window
        const rescheduledJobId = `${dbJobId}_rescheduled_${Date.now()}`;
        await emailQueue.add(
          'sendEmail',
          {
            ...job.data,
            scheduledFor: rateCheck.nextWindowStartTime.toISOString(),
          },
          {
            delay: rateCheck.delayUntilNextWindowMs,
            jobId: rescheduledJobId,
          }
        );

        // Update DB record
        await prisma.emailJob.update({
          where: { id: dbJobId },
          data: {
            status: 'RESCHEDULED',
            scheduledFor: rateCheck.nextWindowStartTime,
            errorMessage: `Hourly limit reached (${rateCheck.currentCount}/${rateCheck.maxLimit}). Automatically rescheduled to ${rateCheck.nextWindowStartTime.toLocaleTimeString()}`,
          },
        });

        return {
          status: 'rescheduled',
          rescheduledFor: rateCheck.nextWindowStartTime,
          reason: 'Hourly rate limit exceeded',
        };
      }

      // 3. Mark DB Status as PROCESSING
      await prisma.emailJob.update({
        where: { id: dbJobId },
        data: { status: 'PROCESSING' },
      });

      // 4. Minimum Throttling Delay between individual sends
      const delay = minDelayMs ?? config.queue.minDelayBetweenEmailsMs;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // 5. Send Email via Ethereal SMTP
      try {
        const sendResult = await emailService.sendEmail({
          from: sender,
          to: recipient,
          subject,
          text: body,
        });

        const now = new Date();

        // 6. Update DB record to SENT
        const updated = await prisma.emailJob.update({
          where: { id: dbJobId },
          data: {
            status: 'SENT',
            sentAt: now,
            previewUrl: sendResult.previewUrl || null,
            errorMessage: null,
          },
        });

        // 7. Index in Elasticsearch
        await searchService.indexEmail(updated);

        console.log(`[Worker] ✅ Successfully dispatched email to ${recipient}! Ethereal preview: ${sendResult.previewUrl}`);
        return {
          status: 'sent',
          previewUrl: sendResult.previewUrl,
          sentAt: now,
        };
      } catch (err: any) {
        console.error(`[Worker] ❌ Failed to dispatch email to ${recipient}:`, err.message);

        await prisma.emailJob.update({
          where: { id: dbJobId },
          data: {
            status: 'FAILED',
            errorMessage: err.message,
            retryCount: { increment: 1 },
          },
        });

        throw err; // Trigger BullMQ retry backoff
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: config.queue.workerConcurrency,
    }
  );

  worker.on('ready', () => {
    console.log(`[BullMQ Worker] Ready! Concurrency: ${config.queue.workerConcurrency} workers active.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ Worker] Job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}
