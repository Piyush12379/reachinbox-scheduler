import axios from 'axios';
import { EmailItem, QueueMetrics, SlackStatus, User } from '../types';

const client = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const api = {
  // Emails
  getScheduledEmails: async (): Promise<{ emails: EmailItem[]; count: number }> => {
    const res = await client.get('/emails/scheduled');
    return res.data;
  },

  getSentEmails: async (): Promise<{ emails: EmailItem[]; count: number }> => {
    const res = await client.get('/emails/sent');
    return res.data;
  },

  searchEmails: async (q: string, status?: string): Promise<{ results: EmailItem[]; count: number }> => {
    const res = await client.get('/emails/search', {
      params: { q, status },
    });
    return res.data;
  },

  scheduleEmails: async (payload: {
    sender?: string;
    recipient?: string;
    recipients?: string[];
    subject: string;
    body: string;
    scheduledFor?: string;
    delayBetweenEmailsSeconds?: number;
    hourlyLimit?: number;
  }) => {
    const res = await client.post('/emails/schedule', payload);
    return res.data;
  },

  parseCsv: async (file: File): Promise<{ totalDetected: number; emails: string[]; preview: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post('/emails/parse-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getQueueMetrics: async (): Promise<QueueMetrics> => {
    const res = await client.get('/emails/metrics');
    return res.data;
  },

  // Slack Integration
  getSlackStatus: async (): Promise<SlackStatus> => {
    const res = await client.get('/slack/status');
    return res.data;
  },

  connectSlack: async (webhookUrl: string, channel?: string) => {
    const res = await client.post('/slack/connect', { webhookUrl, channel });
    return res.data;
  },

  disconnectSlack: async () => {
    const res = await client.post('/slack/disconnect');
    return res.data;
  },

  testSlackAlert: async () => {
    const res = await client.post('/slack/test');
    return res.data;
  },

  // Auth
  googleLogin: async (userInfo?: Partial<User>): Promise<{ user: User }> => {
    const res = await client.post('/auth/google', { userInfo });
    return res.data;
  },

  getMe: async (): Promise<{ user: User }> => {
    const res = await client.get('/auth/me');
    return res.data;
  },
};
