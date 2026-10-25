import axios from 'axios';
import { prisma } from '../db/prisma';
import { config } from '../config/env';

class SlackService {
  public async getActiveWebhook(): Promise<string | null> {
    try {
      const dbConfig = await prisma.slackConfig.findFirst({
        where: { isConnected: true },
      });
      if (dbConfig && dbConfig.webhookUrl) {
        return dbConfig.webhookUrl;
      }
    } catch (err) {
      // DB might not be initialized yet, check fallback
    }

    if (config.slack.webhookUrl) {
      return config.slack.webhookUrl;
    }

    return null;
  }

  public async sendRateLimitAlert(params: {
    sender: string;
    currentCount: number;
    maxLimit: number;
    rescheduledTime: Date;
    recipient: string;
    subject: string;
  }): Promise<{ sent: boolean; message?: string }> {
    const webhookUrl = await this.getActiveWebhook();

    if (!webhookUrl) {
      console.log(`[Slack] No active Slack webhook connected. Rate limit hit for ${params.sender} (${params.currentCount}/${params.maxLimit}). Skipping Slack notification.`);
      return { sent: false, message: 'Slack not connected' };
    }

    try {
      const payload = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 ReachInbox Alert: Sender Rate Limit Exceeded',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n\`${params.sender}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Limit:*\n*${params.currentCount} / ${params.maxLimit} emails*`,
              },
              {
                type: 'mrkdwn',
                text: `*Pending Lead:*\n${params.recipient}`,
              },
              {
                type: 'mrkdwn',
                text: `*Rescheduled Next Window:*\n<!date^${Math.floor(params.rescheduledTime.getTime() / 1000)}^{date_num} {time_secs}|${params.rescheduledTime.toISOString()}>`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `⏰ Job safely delayed to next hourly window without dropping or failing. Idempotency preserved.`,
              },
            ],
          },
        ],
      };

      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      console.log(`[Slack] 🚀 Successfully sent live rate-limit alert to Slack for sender ${params.sender}!`);
      return { sent: true };
    } catch (error: any) {
      console.error('[Slack] Failed to dispatch Slack notification:', error.message);
      return { sent: false, message: error.message };
    }
  }

  public async sendTestNotification(webhookUrl: string): Promise<boolean> {
    try {
      await axios.post(webhookUrl, {
        text: '✅ *ReachInbox Scheduler:* Slack integration successfully connected and verified! You will receive live alerts when email rate limits are triggered.',
      }, { timeout: 5000 });
      return true;
    } catch (err: any) {
      console.error('[Slack] Test notification failed:', err.message);
      return false;
    }
  }
}

export const slackService = new SlackService();
