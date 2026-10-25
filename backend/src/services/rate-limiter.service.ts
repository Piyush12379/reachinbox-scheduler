import { redisClient } from '../config/redis';
import { config } from '../config/env';
import { RateLimitCheckResult } from '../types';

class RateLimiterService {
  /**
   * Generates the Redis key for the current hour window for a given sender
   */
  private getWindowKey(sender: string, date: Date = new Date()): { key: string; nextWindowDate: Date; delayUntilNextMs: number } {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hour = date.getUTCHours();

    const windowId = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}-${String(hour).padStart(2, '0')}`;
    const key = `ratelimit:${sender.toLowerCase().trim()}:${windowId}`;

    const nextWindowDate = new Date(Date.UTC(year, month, day, hour + 1, 0, 0, 0));
    const delayUntilNextMs = Math.max(1000, nextWindowDate.getTime() - date.getTime());

    return { key, nextWindowDate, delayUntilNextMs };
  }

  /**
   * Atomically checks and acquires a quota slot for the current hour window.
   * If quota exceeded, rejects and returns the delay needed until next hour window.
   */
  public async checkAndConsume(
    sender: string,
    customHourlyLimit?: number
  ): Promise<RateLimitCheckResult> {
    const limit = customHourlyLimit || config.queue.maxEmailsPerHour;
    const { key, nextWindowDate, delayUntilNextMs } = this.getWindowKey(sender);

    // Atomically increment
    const currentCount = await redisClient.incr(key);

    if (currentCount === 1) {
      // Set TTL to 2 hours to cleanly auto-expire after the window ends
      await redisClient.expire(key, 7200);
    }

    if (currentCount > limit) {
      // Revert the increment since this send is rejected/rescheduled
      await redisClient.decr(key);
      return {
        allowed: false,
        currentCount: limit,
        maxLimit: limit,
        delayUntilNextWindowMs: delayUntilNextMs,
        nextWindowStartTime: nextWindowDate,
      };
    }

    return {
      allowed: true,
      currentCount,
      maxLimit: limit,
      delayUntilNextWindowMs: 0,
      nextWindowStartTime: nextWindowDate,
    };
  }

  /**
   * Get current usage for display / analytics
   */
  public async getCurrentUsage(sender: string): Promise<{ count: number; limit: number }> {
    const { key } = this.getWindowKey(sender);
    const countStr = await redisClient.get(key);
    return {
      count: countStr ? parseInt(countStr, 10) : 0,
      limit: config.queue.maxEmailsPerHour,
    };
  }
}

export const rateLimiterService = new RateLimiterService();
