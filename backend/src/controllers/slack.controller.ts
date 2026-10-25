import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { slackService } from '../services/slack.service';

export const slackController = {
  // Connect / save Slack webhook or OAuth token
  connect: async (req: Request, res: Response) => {
    try {
      const { webhookUrl, channel } = req.body;

      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        return res.status(400).json({ error: 'Please enter a valid Slack Incoming Webhook URL.' });
      }

      // Test webhook before saving
      const isValid = await slackService.sendTestNotification(webhookUrl);
      if (!isValid) {
        return res.status(400).json({ error: 'Failed to verify Slack webhook. Please verify the URL and permissions.' });
      }

      const updated = await prisma.slackConfig.upsert({
        where: { userId: 'default-user' },
        create: {
          userId: 'default-user',
          webhookUrl,
          channel: channel || '#reachinbox-alerts',
          isConnected: true,
        },
        update: {
          webhookUrl,
          channel: channel || '#reachinbox-alerts',
          isConnected: true,
        },
      });

      return res.json({
        message: 'Slack successfully connected! Test notification sent.',
        config: {
          isConnected: updated.isConnected,
          channel: updated.channel,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Get current Slack integration status
  getStatus: async (_req: Request, res: Response) => {
    try {
      const config = await prisma.slackConfig.findFirst({
        where: { isConnected: true },
      });

      return res.json({
        isConnected: !!config?.isConnected,
        channel: config?.channel || null,
        webhookUrlMasked: config?.webhookUrl
          ? config.webhookUrl.replace(/^(.{25})(.*)(.{8})$/, '$1...$3')
          : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Disconnect Slack
  disconnect: async (_req: Request, res: Response) => {
    try {
      await prisma.slackConfig.updateMany({
        where: { userId: 'default-user' },
        data: { isConnected: false },
      });

      return res.json({ message: 'Slack disconnected successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Send a test rate limit alert
  sendTestAlert: async (_req: Request, res: Response) => {
    try {
      const result = await slackService.sendRateLimitAlert({
        sender: 'outreach@reachinbox.ai',
        currentCount: 20,
        maxLimit: 20,
        rescheduledTime: new Date(Date.now() + 3600000),
        recipient: 'alex.lead@example.com',
        subject: 'Scaling your cold outreach pipeline',
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
};
