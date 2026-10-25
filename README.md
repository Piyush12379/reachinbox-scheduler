# ReachInbox Full-Stack Email Job Scheduler 🚀
> Evaluated for Outbox Labs SDE Internship Assignment • High-Throughput Distributed Email Dispatcher

---

## 🌟 Executive Summary

This project implements a **production-grade distributed email scheduling and dispatch engine** tailored for cold-email outreach at scale (similar to ReachInbox's core infrastructure). It combines a high-concurrency **BullMQ + Redis delayed queue** (strictly **no cron jobs**), **relational database persistence** (SQLite / PostgreSQL with Prisma ORM), **fake SMTP email delivery with Ethereal preview links**, **Elasticsearch search indexing**, a **live BullMQ dashboard UI**, and **real-time Slack notifications on rate-limit triggers**.

The frontend is a sleek, dark-themed dashboard built with **React (Vite) + TypeScript + Tailwind CSS** adhering to the provided ReachInbox Figma design with real-time queue metrics, Google OAuth profile display, CSV lead parsing, and dynamic search.

---

## 🏗️ Architecture Overview

```
                      +------------------------------------------+
                      |         ReachInbox React Frontend        |
                      |   (Vite + TypeScript + Tailwind CSS)     |
                      +------------------------------------------+
                                           |
                                    REST APIs / JSON
                                           v
+-----------------------------------------------------------------------------------+
|                            Express.js Backend (Node.js)                           |
|                                                                                   |
|  +--------------------+   +----------------------+   +-------------------------+  |
|  | /api/emails/sched  |   | /api/slack/connect   |   | /admin/queues (Bull-UI) |  |
|  +--------------------+   +----------------------+   +-------------------------+  |
|           |                                                                       |
|           v                                                                       |
|  +--------------------+         +----------------------------------------------+  |
|  | Prisma ORM (DB)    | <-----> |   BullMQ Queue (email-scheduler-queue)       |  |
|  | - Single truth     |         |   Delayed ZSET in Redis (no cron)            |  |
|  +--------------------+         +----------------------------------------------+  |
|                                                          |                        |
|                                          Configurable Concurrency Workers (1..N)  |
|                                                          v                        |
|                                         +--------------------------------------+  |
|                                         | Rate Limiter (Redis Sliding Window)  |  |
|                                         +--------------------------------------+  |
|                                            /                                \     |
|                                  Within Quota                          Quota Hit  |
|                                        v                                    v     |
|                          +---------------------------+       +-----------------+  |
|                          | Ethereal SMTP Mailer      |       | Live Slack Alert|  |
|                          | + Elasticsearch Indexing  |       | & Reschedule to |  |
|                          | + Mark SENT in DB         |       | Next Hour Window|  |
|                          +---------------------------+       +-----------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 🔑 Core Technical Decisions & Answers to Prompts

### 1. How Scheduling Works (Strictly Zero Cron)
* **BullMQ Delayed Jobs**: When an email (or batch of CSV leads) is submitted, the target execution time $T$ is computed.
* The delay is calculated as $\Delta = \max(0, T - \text{now})$.
* Jobs are inserted directly into the Redis sorted set backing BullMQ: `emailQueue.add('sendEmail', jobData, { delay: deltaMs, jobId: uniqueId })`.
* Redis automatically promotes delayed jobs to the waiting queue the exact millisecond the delay expires without any CPU polling or cron schedules.

### 2. How Persistence on Restart is Handled
* **Dual Layer Persistence**:
  1. **BullMQ / Redis Persistence**: All delayed and active jobs reside in Redis memory backed by Redis RDB/AOF snapshots. When the worker or server crashes and restarts, BullMQ reads delayed jobs straight from Redis and fires them when due.
  2. **Relational Database Single Source of Truth**: Every job is created in the database with status `SCHEDULED`.
  3. **Boot Reconciliation**: On backend boot, `schedulerService.recoverPendingJobs()` scans the DB for any `SCHEDULED`, `RESCHEDULED`, or interrupted `PROCESSING` jobs. If any job is missing from BullMQ, it is immediately re-enqueued with the remaining delay $\Delta = \max(0, \text{scheduledFor} - \text{now})$.
* **Zero Duplication / Idempotency**:
  * Each job has a deterministic unique ID (`jobId = job_{timestamp}_{index}_{hash}`).
  * The BullMQ worker checks the DB status before dispatching. If the status is already `SENT`, the job is safely discarded with an idempotency log.

### 3. Rate Limiting & Concurrency Architecture
* **Configurable Worker Concurrency**:
  * Configured via `WORKER_CONCURRENCY=5` in `.env`.
  * The BullMQ worker processes jobs across multiple concurrent async threads safely.
* **Delay Between Each Email**:
  * Configurable via `MIN_DELAY_BETWEEN_EMAILS_MS` (default 2000ms / 2 seconds).
  * Mimics cold outreach throttling per mailbox to preserve domain reputation.
* **Hourly Rate Limiting**:
  * Enforced per sender via Redis hourly window counters: `ratelimit:{sender}:{YYYY-MM-DD-HH}`.
  * Counter is incremented atomically (`INCR`) with a 2-hour TTL.
  * **Behavior When Limit Reached**: Jobs are **never dropped or permanently failed**. Instead:
    1. The exact duration until the next hourly window is calculated.
    2. The job is rescheduled into BullMQ with a delay matching the start of the next hour window.
    3. The database record is updated to `RESCHEDULED`.
    4. A **live Slack notification** is immediately dispatched!
* **Live Slack Notification**:
  * Connected via Webhook or OAuth in the dashboard.
  * When a sender hits the hourly threshold, an alert is sent displaying: Sender, Hourly Usage ($20/20$), Pending Lead, and Next Rescheduled Window.
  * Disconnect/Reconnect handling: If Slack is not connected, the scheduler logs the event and reschedules without crashing. If reconnected later, live alerts resume without redeploying.

### 4. Elasticsearch Indexing & Search
* Emails are automatically indexed into Elasticsearch (`emails` index) on schedule and send.
* Full-text multi-match search (`/api/emails/search?q=query`) queries subject, body, recipient, and sender.
* **Resilient Fallback**: If Elasticsearch is not running, the API transparently falls back to relational DB search without throwing 500 errors.

---

## 🛠️ Prerequisites

* **Node.js**: v18+ (tested on Node v24.21.0)
* **npm**: v9+
* **Redis**: Local Redis or via Docker (port 6379)
* **Database**: SQLite (default, zero-setup) or PostgreSQL (via Docker / cloud)

---

## 🚀 Quick Start Guide

### 1. Start Redis
* **Option A (Docker)**:
  ```bash
  docker compose up -d redis
  ```
* **Option B (Windows Portable / Local)**:
  Run `redis-server.exe` on port `6379`.

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Initialize Prisma SQLite Database (or Postgres)
npx prisma db push

# Start Backend Dev Server
npm run dev
```
* Backend runs at: `http://localhost:5000`
* BullMQ Real-Time Queue Board: `http://localhost:5000/admin/queues`

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Frontend Dev Server
npm run dev
```
* Frontend runs at: `http://localhost:3000`

---

## ⚙️ Environment Variables (`backend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | HTTP Express server port |
| `DATABASE_URL` | `"file:./dev.db"` | Prisma Database connection URL |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `WORKER_CONCURRENCY` | `5` | Number of concurrent BullMQ worker threads |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `2000` | Minimum throttle delay between individual sends |
| `MAX_EMAILS_PER_HOUR` | `20` | Maximum emails per sender per hour window |
| `ETHEREAL_USER` | `""` | Ethereal user (auto-generated if empty) |
| `ETHEREAL_PASS` | `""` | Ethereal password (auto-generated if empty) |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch node URL |
| `SLACK_WEBHOOK_URL` | `""` | Slack incoming webhook URL for rate-limit alerts |

---

## 🧪 Testing Features (Walkthrough for Reviewers)

### 1. Creating Scheduled Emails via CSV Upload
1. Open `http://localhost:3000`.
2. Click **"Compose New Email"**.
3. Drag & drop the provided `demo-dataset.csv` (10 leads).
4. Notice the badge: `10 leads detected`.
5. Click **"+ Insert Sample Template"** or enter subject & body.
6. Set Start Time, Delay (e.g. 2 sec), and Hourly Limit (e.g. 20/hr).
7. Click **"Schedule Campaign"**.
8. Switch to **"Scheduled Emails"** tab to see all pending jobs with scheduled times.

### 2. Monitoring Real-Time Dispatch & Ethereal Previews
1. As the BullMQ worker processes jobs, status updates to `PROCESSING` and then `SENT`.
2. Switch to **"Sent Emails"** tab.
3. Click **"View in Ethereal"** next to any dispatched email to inspect the email in Ethereal Webmail.

### 3. Server Restart Persistence Scenario
1. Schedule 5 emails for 1 minute into the future.
2. Stop the backend server (`Ctrl + C`).
3. Note that the jobs are safely stored in both the database and Redis delayed set.
4. Restart the backend server (`npm run dev`).
5. Observe the console log: `[Recovery] Reconciliation complete: 5 jobs verified and restored.`
6. When the 1 minute expires, all jobs execute cleanly at the scheduled time!

### 4. Hourly Rate Limiting & Live Slack Alert
1. In the Compose modal, set **Hourly Limit = 2**.
2. Upload `demo-dataset.csv` (10 leads) and schedule immediately.
3. The first 2 emails send successfully.
4. On the 3rd email, the worker logs: `⚠️ RATE LIMIT REACHED for sender outreach@reachinbox.ai (2/2)!`
5. The remaining jobs are automatically rescheduled to the start of the next hour window.
6. A verified alert is sent to your connected Slack channel.

### 5. BullMQ Live Dashboard
Visit `http://localhost:5000/admin/queues` to inspect live job states: Active, Delayed, Completed, and Failed.

---

## 📂 Project Structure

```
reachinbox-scheduler/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database models (EmailJob, User, SlackConfig)
│   ├── src/
│   │   ├── config/                # Environment and Redis client configuration
│   │   ├── controllers/           # REST API route handlers
│   │   ├── queues/                # BullMQ Queue and Worker with concurrency & rate limiter
│   │   ├── routes/                # Express routes (emails, auth, slack)
│   │   ├── services/              # Ethereal SMTP, Slack alert, Search, and Scheduler services
│   │   ├── types/                 # Shared TypeScript interfaces
│   │   └── server.ts              # Express server + Bull Board UI + Bootstrapper
├── frontend/
│   ├── src/
│   │   ├── components/            # Header, EmailTabs, EmailTable, ComposeModal, SlackModal, LoginModal
│   │   ├── services/api.ts        # Axios client
│   │   ├── types.ts               # Frontend interfaces
│   │   ├── App.tsx                # Master dashboard state & real-time polling
│   │   └── index.css              # Tailwind CSS styling
├── demo-dataset.csv               # 10 sample B2B leads for testing CSV parser
├── docker-compose.yml             # Docker stack for Redis, Postgres & Elasticsearch
└── README.md
```

---

## 🤝 Submission Contacts & Access
* **GitHub Access**: Invited `mitrajit` and `Yadav036` to repository.
* **Submission Form**: [ClickUp Form Link](https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST)
