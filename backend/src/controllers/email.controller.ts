import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { schedulerService } from '../services/scheduler.service';
import { searchService } from '../services/search.service';
import { emailQueue } from '../queues/email.queue';
import { rateLimiterService } from '../services/rate-limiter.service';

export const emailController = {
  // Parse uploaded CSV/text file and extract detected emails
  parseCsvLeads: async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = fileContent.match(emailRegex) || [];
      const uniqueEmails = Array.from(new Set(matches.map((e) => e.toLowerCase())));

      return res.json({
        totalDetected: uniqueEmails.length,
        emails: uniqueEmails,
        preview: uniqueEmails.slice(0, 5),
      });
    } catch (err: any) {
      console.error('[Controller] Error parsing CSV:', err.message);
      return res.status(500).json({ error: 'Failed to parse lead file.' });
    }
  },

  // Schedule email sends
  schedule: async (req: Request, res: Response) => {
    try {
      const {
        sender,
        recipient,
        recipients,
        subject,
        body,
        scheduledFor,
        delayBetweenEmailsSeconds,
        hourlyLimit,
      } = req.body;

      if (!subject || !body) {
        return res.status(400).json({ error: 'Subject and body are required.' });
      }

      let allRecipients: string[] = [];

      if (recipients && Array.isArray(recipients)) {
        allRecipients = recipients;
      } else if (recipient) {
        allRecipients = [recipient];
      }

      if (allRecipients.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one recipient.' });
      }

      const result = await schedulerService.scheduleEmails({
        sender,
        recipients: allRecipients,
        subject,
        body,
        scheduledFor,
        delayBetweenEmailsSeconds: delayBetweenEmailsSeconds ? Number(delayBetweenEmailsSeconds) : 2,
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : undefined,
      });

      return res.status(201).json({
        message: `Successfully scheduled ${result.count} email(s).`,
        batchId: result.batchId,
        count: result.count,
        jobs: result.jobs,
      });
    } catch (err: any) {
      console.error('[Controller] Schedule error:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to schedule emails.' });
    }
  },

  // Get scheduled/pending emails
  getScheduled: async (req: Request, res: Response) => {
    try {
      const emails = await prisma.emailJob.findMany({
        where: {
          status: { in: ['SCHEDULED', 'RESCHEDULED', 'PROCESSING'] },
        },
        orderBy: { scheduledFor: 'asc' },
      });
      return res.json({ emails, count: emails.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Get sent/failed emails
  getSent: async (req: Request, res: Response) => {
    try {
      const emails = await prisma.emailJob.findMany({
        where: {
          status: { in: ['SENT', 'FAILED'] },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return res.json({ emails, count: emails.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Search emails via Elasticsearch / DB Fallback
  search: async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const status = req.query.status as string | undefined;

      const results = await searchService.searchEmails(query, status);
      return res.json({ results, count: results.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Live Queue Metrics
  getQueueMetrics: async (_req: Request, res: Response) => {
    try {
      const counts = await emailQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
      const senderUsage = await rateLimiterService.getCurrentUsage('outreach@reachinbox.ai');

      return res.json({
        bullmq: counts,
        rateLimit: senderUsage,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
};
