export interface EmailJobData {
  dbJobId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledFor: string;
  batchId?: string;
  hourlyLimit?: number;
  minDelayMs?: number;
}

export interface ScheduleEmailRequest {
  sender?: string;
  recipient?: string;
  recipients?: string[];
  subject: string;
  body: string;
  scheduledFor?: string; // ISO Date string
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  maxLimit: number;
  delayUntilNextWindowMs: number;
  nextWindowStartTime: Date;
}
