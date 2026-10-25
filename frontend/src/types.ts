export interface EmailItem {
  id: string;
  jobId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RESCHEDULED';
  scheduledFor: string;
  sentAt?: string | null;
  previewUrl?: string | null;
  errorMessage?: string | null;
  batchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id?: string;
  name: string;
  email: string;
  avatar: string;
}

export interface QueueMetrics {
  bullmq: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
  rateLimit: {
    count: number;
    limit: number;
  };
}

export interface SlackStatus {
  isConnected: boolean;
  channel: string | null;
  webhookUrlMasked: string | null;
}
