import { prisma } from '../db/prisma';
import { emailQueue } from '../queues/email.queue';
import { EmailJobData, ScheduleEmailRequest } from '../types';
import { searchService } from './search.service';

class SchedulerService {
  /**
   * Schedule one or more emails with persistent BullMQ delayed jobs
   */
  public async scheduleEmails(payload: ScheduleEmailRequest): Promise<{
    count: number;
    batchId: string;
    jobs: any[];
  }> {
    const sender = payload.sender || 'outreach@reachinbox.ai';
    const recipients = payload.recipients && payload.recipients.length > 0
      ? payload.recipients
      : payload.recipient
      ? [payload.recipient]
      : [];

    if (recipients.length === 0) {
      throw new Error('At least one recipient email address is required.');
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseStartTime = payload.scheduledFor ? new Date(payload.scheduledFor).getTime() : Date.now();
    const delayBetweenMs = (payload.delayBetweenEmailsSeconds ?? 2) * 1000;
    const hourlyLimit = payload.hourlyLimit;

    const scheduledJobs: any[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient) continue;

      // Stagger sending time for batch outreach
      const targetTimeMs = Math.max(Date.now(), baseStartTime + i * delayBetweenMs);
      const targetDate = new Date(targetTimeMs);
      const delayMs = Math.max(0, targetTimeMs - Date.now());

      const dbJobId = `job_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;

      // 1. Persist to Relational DB first
      const dbRecord = await prisma.emailJob.create({
        data: {
          id: dbJobId,
          jobId: dbJobId,
          sender,
          recipient,
          subject: payload.subject,
          body: payload.body,
          status: 'SCHEDULED',
          scheduledFor: targetDate,
          batchId,
        },
      });

      // 2. Schedule via BullMQ Delayed Job (NO CRON)
      const jobData: EmailJobData = {
        dbJobId,
        sender,
        recipient,
        subject: payload.subject,
        body: payload.body,
        scheduledFor: targetDate.toISOString(),
        batchId,
        hourlyLimit,
        minDelayMs: delayBetweenMs,
      };

      await emailQueue.add('sendEmail', jobData, {
        delay: delayMs,
        jobId: dbJobId, // Guaranteed idempotency
      });

      // 3. Index in Search Service
      await searchService.indexEmail(dbRecord);

      scheduledJobs.push(dbRecord);
    }

    console.log(`[Scheduler] Successfully scheduled ${scheduledJobs.length} emails in batch ${batchId}. First run in ${Math.max(0, baseStartTime - Date.now())}ms`);
    return {
      count: scheduledJobs.length,
      batchId,
      jobs: scheduledJobs,
    };
  }

  /**
   * RESTART PERSISTENCE RECOVERY:
   * Called on server startup to reconcile any SCHEDULED/RESCHEDULED jobs
   * from the database with BullMQ to guarantee no lost jobs after a crash or restart.
   */
  public async recoverPendingJobs(): Promise<number> {
    console.log('[Recovery] Checking for pending/scheduled jobs in database...');
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RESCHEDULED', 'PROCESSING'] },
      },
    });

    let recoveredCount = 0;
    const now = Date.now();

    for (const job of pendingJobs) {
      const existingBullJob = await emailQueue.getJob(job.jobId);

      if (!existingBullJob) {
        const delayMs = Math.max(0, job.scheduledFor.getTime() - now);
        console.log(`[Recovery] Re-enqueueing lost job ${job.id} for recipient ${job.recipient} with delay ${delayMs}ms`);

        await emailQueue.add(
          'sendEmail',
          {
            dbJobId: job.id,
            sender: job.sender,
            recipient: job.recipient,
            subject: job.subject,
            body: job.body,
            scheduledFor: job.scheduledFor.toISOString(),
            batchId: job.batchId || undefined,
          },
          {
            delay: delayMs,
            jobId: job.jobId,
          }
        );
        recoveredCount++;
      }
    }

    console.log(`[Recovery] Reconciliation complete: ${recoveredCount} jobs verified and restored.`);
    return recoveredCount;
  }
}

export const schedulerService = new SchedulerService();
