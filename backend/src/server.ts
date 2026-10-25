import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config/env';
import { connectDB } from './db/prisma';
import { emailQueue } from './queues/email.queue';
import { startEmailWorker } from './queues/email.worker';
import { schedulerService } from './services/scheduler.service';
import { emailService } from './services/email.service';

import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import authRoutes from './routes/auth.routes';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup BullMQ Dashboard at /admin/queues
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// API Routes
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    bullBoardUrl: `http://localhost:${config.port}/admin/queues`,
  });
});

// Bootstrapping
async function bootstrap() {
  try {
    console.log('--------------------------------------------------');
    console.log('🚀 Starting ReachInbox Email Job Scheduler Backend...');
    console.log('--------------------------------------------------');

    // 1. Connect to Database
    await connectDB();

    // 2. Pre-warm Ethereal SMTP
    await emailService.getTransporter();

    // 3. Start BullMQ Worker
    startEmailWorker();

    // 4. Persistence On Restart: Reconcile and recover pending jobs
    await schedulerService.recoverPendingJobs();

    // 5. Start HTTP Server
    app.listen(config.port, () => {
      console.log(`\n✅ Server is live on: http://localhost:${config.port}`);
      console.log(`📊 BullMQ Real-time Queue Dashboard: http://localhost:${config.port}/admin/queues`);
      console.log(`⚡ Concurrency Level: ${config.queue.workerConcurrency} workers`);
      console.log(`⏱️  Min Delay Between Sends: ${config.queue.minDelayBetweenEmailsMs}ms`);
      console.log(`🛑 Max Emails Per Hour: ${config.queue.maxEmailsPerHour}\n`);
    });
  } catch (err: any) {
    console.error('Fatal bootstrapping error:', err);
    process.exit(1);
  }
}

bootstrap();
