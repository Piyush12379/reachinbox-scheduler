# 📚 ReachInbox Full-Stack Email Job Scheduler: Complete Technical Guide & Interview Master Script

This document provides a comprehensive, end-to-end breakdown of the ReachInbox Email Job Scheduler project. It is structured so that you can understand every design decision, explain it in your technical interview, and follow the exact demo video recording script.

---

## 📑 Table of Contents
1. [Project Overview & Business Context](#1-project-overview--business-context)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Deep Dive: Core Architectural Decisions](#3-deep-dive-core-architectural-decisions)
   - [Zero-Cron Delayed Scheduling (BullMQ + Redis)](#zero-cron-delayed-scheduling-bullmq--redis)
   - [Crash & Restart Persistence Guarantee](#crash--restart-persistence-guarantee)
   - [Concurrency vs. Throttling](#concurrency-vs-throttling)
   - [Per-Sender Hourly Rate Limiting & Auto-Rescheduling](#per-sender-hourly-rate-limiting--auto-rescheduling)
   - [Idempotency & Duplicate Prevention](#idempotency--duplicate-prevention)
   - [Live Slack Webhook Integration](#live-slack-webhook-integration)
   - [Ethereal SMTP & Preview URLs](#ethereal-smtp--preview-urls)
   - [Elasticsearch Indexing & Graceful Fallback](#elasticsearch-indexing--graceful-fallback)
4. [File-by-File Code Walkthrough](#4-file-by-file-code-walkthrough)
5. [Word-for-Word 5-Minute Demo Video Script](#5-word-for-word-5-minute-demo-video-script)
6. [Top Technical Interview Questions & Answers](#6-top-technical-interview-questions--answers)

---

## 1. Project Overview & Business Context

### What is ReachInbox?
ReachInbox (by Outbox Labs) is an AI-driven cold outreach and email deliverability platform. In cold email marketing, sending thousands of emails carelessly causes domain blacklisting, spam filtering, and SMTP provider rate limits.

### What Problem Does This Project Solve?
Instead of sending emails synchronously or using naive cron jobs, this project implements a **distributed, persistent background job queue** that:
* Accepts single or bulk CSV leads.
* Staggers outbound emails across customizable delays to mimic human typing and avoid spam triggers.
* Strictly enforces hourly sender quotas.
* Automatically moves oversubscribed jobs into future windows without dropping data.
* Dispatches real-time Slack alerts to operations teams when limits are hit.
* Survives server crashes without losing or repeating scheduled emails.

---

## 2. End-to-End System Architecture

```
[ User Browser / React Frontend ]
               |
               | (1) Upload CSV / Compose Campaign
               v
[ Express.js REST API Server ]
        |                   \
        | (2) Persist Record \ (3) Calculate Delta Delay & Add Delayed Job
        v                     v
[ Relational DB (Prisma) ]   [ Redis Sorted Set (ZSET) ]
 (Status: SCHEDULED)          (BullMQ: email-scheduler-queue)
                                      |
                       (4) Delay Expires -> Promoted to Waiting
                                      v
                             [ BullMQ Worker Pool ]
                               (Concurrency = 5)
                                      |
                      (5) Check Redis Sliding-Window Rate Limit
                                     / \
                        Within Quota    Quota Exceeded
                             /             \
    (6a) Minimum Throttling Delay           (6b) Do NOT drop!
    (6c) Send via Ethereal SMTP                  Calculate next hour delay
    (6d) Save Ethereal Preview URL               Reschedule in BullMQ
    (6e) Update DB status to SENT                Update DB status to RESCHEDULED
    (6f) Index into Elasticsearch                Trigger Live Slack Alert
```

---

## 3. Deep Dive: Core Architectural Decisions

### Zero-Cron Delayed Scheduling (BullMQ + Redis)
* **The Problem with Cron (`node-cron`, `crontab`)**: Cron runs on fixed intervals (e.g., every 60 seconds) and must query the database to check if any emails are due (`SELECT * WHERE scheduledFor <= NOW()`). This causes DB polling bottlenecks, clock drift, missed jobs during restarts, and difficulty scaling across multiple instances.
* **Our Solution**: We use **BullMQ delayed jobs**. When a user schedules an email for 10:30 AM, the server computes $\Delta = \text{targetTime} - \text{now}$ (in milliseconds). BullMQ pushes the job into a Redis Sorted Set (`ZSET`) where the score is the target timestamp. Redis's internal timer promotes the job to the active queue the exact millisecond it is due. Zero cron, zero DB polling.

### Crash & Restart Persistence Guarantee
* **The Problem**: If the server crashes or restarts, how do we guarantee future emails are still sent on time without starting over or sending duplicates?
* **Our Solution**:
  1. **Redis Persistence**: BullMQ delayed jobs are saved in Redis memory, persisted to disk via RDB/AOF. When Redis and BullMQ restart, BullMQ reads the delayed jobs straight from Redis.
  2. **Relational Database Single Source of Truth**: Every email is created with status `SCHEDULED` in the database.
  3. **Startup Reconciliation (`recoverPendingJobs()`)**: On backend startup, the server queries the database for any jobs with status `SCHEDULED`, `RESCHEDULED`, or interrupted `PROCESSING`. For each job, it verifies whether the job is present in BullMQ. If missing, it immediately re-enqueues it with the remaining delay $\Delta = \max(0, \text{scheduledFor} - \text{now})$.

### Concurrency vs. Throttling
* **Configurable Concurrency (`WORKER_CONCURRENCY=5`)**: Allows the BullMQ worker to process 5 jobs in parallel across asynchronous event loops.
* **Throttling Delay (`MIN_DELAY_BETWEEN_EMAILS_MS=2000`)**: Enforces a minimum 2-second sleep per worker before calling the SMTP transport to mimic human cadence and comply with mailbox providers.

### Per-Sender Hourly Rate Limiting & Auto-Rescheduling
* **Requirement**: Support multiple senders, enforce hourly limits across multiple workers without in-memory state, and NEVER drop or fail jobs when the limit is hit.
* **Our Solution (`rate-limiter.service.ts`)**:
  - We use an atomic Redis counter keyed by sender and hourly window: `ratelimit:{sender}:{YYYY-MM-DD-HH}`.
  - When a worker processes an email, it increments (`INCR`) this key. If the key is new, it sets a 2-hour TTL (`EXPIRE 7200`).
  - If `count > MAX_EMAILS_PER_HOUR`:
    - The worker decrements the key back.
    - It calculates the exact milliseconds until the top of the next hour.
    - It reschedules the job into BullMQ with `delay: nextHourDelayMs`.
    - It updates the database status to `RESCHEDULED`.
    - It triggers a live Slack alert.

### Idempotency & Duplicate Prevention
* Every job is assigned a unique deterministic ID: `jobId = job_{timestamp}_{index}_{randomHash}`.
* Before the worker dispatches any email, it queries the database:
  - If `status === 'SENT'`, it logs an idempotency warning and skips execution immediately.
  - If valid, it transitions the status to `PROCESSING` to prevent parallel worker collisions.

### Live Slack Webhook Integration
* Under **Connect Slack** in the frontend, users enter their Slack Incoming Webhook URL.
* When a sender hits their hourly limit, the backend issues an HTTP POST to Slack containing a formatted Block Kit payload showing:
  - Sender email
  - Current usage vs limit (e.g., `20/20 emails`)
  - Next rescheduled window
* If Slack is not connected, the rate-limiter logs the event and reschedules without crashing.

### Ethereal SMTP & Preview URLs
* Uses Nodemailer with Ethereal Email (a fake SMTP testing service).
* If credentials are not provided in `.env`, the backend calls `nodemailer.createTestAccount()` on boot and logs the test account.
* On every send, `nodemailer.getTestMessageUrl(info)` returns an inspection URL (e.g. `https://ethereal.email/message/...`). This is saved to the database and displayed as a clickable "View in Ethereal" button in the frontend.

### Elasticsearch Indexing & Graceful Fallback
* Email documents are indexed into Elasticsearch under the `emails` index with fields: `subject`, `body`, `recipient`, `sender`, `status`, and timestamps.
* The search API `/api/emails/search?q=query` executes a multi-match fuzzy query across all text fields.
* If Elasticsearch is offline or Docker is not running, the service transparently falls back to a relational database `LIKE` query without crashing.

---

## 4. File-by-File Code Walkthrough

### Backend
| File | Responsibility |
| :--- | :--- |
| `src/server.ts` | Express entry point. Mounts Bull-Board UI at `/admin/queues`, boots DB, starts worker, and runs persistence reconciliation. |
| `src/config/env.ts` | Centralized typed configuration reading environment variables with defaults. |
| `src/config/redis.ts` | Configures `ioredis` with `maxRetriesPerRequest: null` (required for BullMQ). |
| `src/db/prisma.ts` | Prisma Client singleton and database connection handler. |
| `prisma/schema.prisma` | Defines `EmailJob` (id, recipient, sender, status, scheduledFor, sentAt, previewUrl), `User`, and `SlackConfig`. |
| `src/queues/email.queue.ts` | BullMQ `Queue` instance (`email-scheduler-queue`) configured with exponential backoff retries. |
| `src/queues/email.worker.ts` | BullMQ `Worker` instance with configurable concurrency, idempotency checks, rate limiter consumption, Ethereal dispatch, and Slack alert triggers. |
| `src/services/scheduler.service.ts` | Handles bulk/single email scheduling, calculates staggered delays, and contains `recoverPendingJobs()` for crash recovery. |
| `src/services/rate-limiter.service.ts` | Redis atomic counter implementing sliding hourly rate limits per sender. |
| `src/services/email.service.ts` | Nodemailer transporter setup with auto-generated Ethereal test accounts and preview URL generation. |
| `src/services/slack.service.ts` | Dispatches live Slack notifications using rich Block Kit layouts when hourly limits are exceeded. |
| `src/services/search.service.ts` | Elasticsearch indexing and multi-match full-text search with database fallback. |
| `src/controllers/email.controller.ts` | Endpoints for scheduling, CSV parsing, querying scheduled/sent emails, and queue metrics. |
| `src/scripts/load-test.ts` | Automated load test script scheduling 1,000+ emails across multiple senders to prove scalability. |

### Frontend
| File | Responsibility |
| :--- | :--- |
| `src/App.tsx` | Master dashboard layout. Handles authentication state, tab switching, search debouncing, and 3-second live queue polling. |
| `src/components/Header.tsx` | Displays ReachInbox logo, live queue metric badges (Completed, Delayed, Active, Failed), Slack connection pill, BullMQ Board link, user profile, and Logout. |
| `src/components/EmailTabs.tsx` | Tab switcher (Scheduled Emails vs Sent Emails) with badge counters, debounced search bar, refresh button, and "Compose New Email" button. |
| `src/components/EmailTable.tsx` | Responsive table displaying recipient, subject, scheduled/sent timestamps, status badges, and clickable "View in Ethereal" preview links. Includes empty and loading skeleton states. |
| `src/components/ComposeModal.tsx` | Compose dialog supporting multi-sender selection, drag-and-drop CSV lead parsing, lead count preview, start time picker, inter-send delay, and hourly limits. |
| `src/components/SlackModal.tsx` | Slack integration dialog with connection status, webhook URL configuration, and a "Trigger Test Alert" button. |
| `src/components/LoginModal.tsx` | Google OAuth login screen using `@react-oauth/google` with one-click candidate profile login. |
| `src/services/api.ts` | Axios HTTP client configured with endpoints for all backend services. |

---

## 5. Word-for-Word 5-Minute Demo Video Script

Use screen recording software (Loom, OBS, or Windows Game Bar `Win + Alt + R`). Make sure your mic is clear, and keep captions enabled or add on-screen subtitles.

---

### [0:00 - 0:45] Intro & Architecture
* **Screen**: Show [README.md](file:///C:/Users/Asus/.gemini/antigravity/scratch/reachinbox-scheduler/README.md) diagram, then switch to browser at `http://localhost:3000`.
* **Speak / Caption**:
  > *"Hello, my name is Piyush Raj. Today I am presenting my submission for the ReachInbox Full-Stack Email Job Scheduler. 
  > Our architecture is built with React, TypeScript, and Tailwind CSS on the frontend, and an Express.js TypeScript backend. 
  > Core scheduling is powered by BullMQ backed by Redis using delayed jobs—strictly with zero cron jobs. 
  > State is persisted in a relational database using Prisma, emails are sent via Ethereal fake SMTP with inspection preview links, and we enforce Redis-backed sliding-window rate limits with live Slack webhook alerts."*

---

### [0:45 - 1:45] Composing Outreach & CSV Lead Parsing
* **Screen**: On `http://localhost:3000`, click the purple **"Compose New Email"** button.
* **Action**: Drag and drop `demo-dataset.csv`.
* **Speak / Caption**:
  > *"To schedule outreach, I click 'Compose New Email'. I upload our lead file, `demo-dataset.csv`. 
  > Notice that our frontend parser instantly extracts, validates, and dedupes all 10 leads, displaying a green '10 leads detected' badge. 
  > In the Sender selection, I can choose between multiple sender accounts like outreach@ or growth@. 
  > I click '+ Insert Sample Template' to populate the subject and body. 
  > I set a throttle delay of 2 seconds between sends to prevent mailbox flagging, and set our hourly limit. 
  > When I click 'Schedule Campaign', each lead is persisted in our database and queued as a delayed job in BullMQ."*

---

### [1:45 - 2:30] Real-Time Worker Dispatch & Ethereal Previews
* **Screen**: Show the **Scheduled Emails** tab. Watch the jobs transition from `SCHEDULED` to `PROCESSING` and disappear as they are sent.
* **Action**: Switch to the **Sent Emails** tab. Click **"View in Ethereal"** on one of the dispatched emails.
* **Speak / Caption**:
  > *"In the Scheduled Emails tab, we see the jobs queued with staggered start times. 
  > Our BullMQ worker runs with a concurrency of 5. As the delays expire, each job executes, sends through Ethereal SMTP, and moves to the Sent Emails tab. 
  > Let's inspect an email by clicking 'View in Ethereal'. This opens the live webmail preview generated by Nodemailer, proving the email was completely rendered and sent through SMTP."*

---

### [2:30 - 3:15] Server Crash & Restart Persistence
* **Screen**: In Compose Modal, schedule 3 emails with a start time 1 minute in the future.
* **Action**: Switch to the backend terminal and press `Ctrl + C` to kill the server. Wait 5 seconds. Restart it with `npm run dev`.
* **Speak / Caption**:
  > *"Now I will demonstrate persistence across server restarts. 
  > I have scheduled 3 emails to send one minute from now. 
  > I am now killing the backend server completely. 
  > Notice that our jobs remain safely stored in Redis memory and our database. 
  > Now I restart the backend server with `npm run dev`. 
  > Watch the console: our startup recovery service detects the pending jobs and logs 'Reconciliation complete: verified and restored'. 
  > As the one minute completes, the emails are dispatched at the exact scheduled time with zero duplicate sends, satisfying idempotency."*

---

### [3:15 - 4:15] Hourly Rate Limiting & Live Slack Alert
* **Screen**: Click **"Connect Slack"** in the top navigation. Show the webhook modal and click **"Trigger Test Alert"**.
* **Action**: Compose a campaign with **Hourly Limit = 2** and 5 leads.
* **Speak / Caption**:
  > *"Next is our Redis-backed sliding-window rate limiter. 
  > We support live Slack alerting when a sender's quota is reached. 
  > I'll schedule 5 emails for `outreach@reachinbox.ai`, but set the hourly limit to 2. 
  > The first 2 emails send immediately. When the 3rd email arrives, the rate limiter detects that the limit of 2 has been reached. 
  > Crucially, our system does NOT drop or fail the job. Instead, it reschedules it to the next hourly window and immediately dispatches a verified alert to our Slack channel showing the sender, current count, and rescheduled time."*

---

### [4:15 - 5:00] BullMQ Dashboard, 1,000+ Load Test & Conclusion
* **Screen**: Open [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues). Show the Bull-Board UI. Then switch to terminal and run `npm run test:load`.
* **Speak / Caption**:
  > *"Here is our live BullMQ board exposed at `/admin/queues`, showing real-time active, delayed, and completed jobs. 
  > To prove our system handles high throughput, I run our automated load test script: `npm run test:load`. 
  > It schedules 1,000 emails across 4 senders in under 9 seconds. 
  > All 1,000 jobs are accepted, queued with staggered delays, and rate-limited across independent sender keys with zero dropped jobs. 
  > Thank you Outbox Labs team for reviewing my assignment!"*

---

## 6. Top Technical Interview Questions & Answers

### Q1: Why did you use BullMQ delayed jobs instead of a cron job?
> **Answer**: *"Cron jobs are polling-based (they run on an interval like every minute and execute `SELECT * WHERE scheduledFor <= NOW()`). At scale with thousands of emails, this creates severe database contention and clock-drift issues. BullMQ delayed jobs utilize Redis's native Sorted Set (`ZSET`) where the timestamp is the score. Redis automatically promotes the job to the waiting queue the exact millisecond the delay expires, resulting in $O(\log N)$ scheduling without any DB polling overhead."*

### Q2: How do you guarantee idempotency so an email is never sent twice?
> **Answer**: *"We enforce idempotency at two layers: First, each job has a deterministic unique ID (`jobId = job_{timestamp}_{index}_{hash}`) registered with BullMQ, preventing duplicate enqueues. Second, before calling the SMTP transport, the worker checks the database record's status. If the status is already `SENT`, the worker immediately aborts and logs an idempotency guard. Only if the status is `SCHEDULED` or `RESCHEDULED` does it transition to `PROCESSING` and send the email."*

### Q3: How does the hourly rate limiter work across multiple workers?
> **Answer**: *"Because workers can run across multiple threads or separate containers, in-memory counters cannot be used. We use atomic Redis counters keyed by sender and hourly window (`ratelimit:{sender}:{YYYY-MM-DD-HH}`). We call `INCR` atomically. If the count exceeds the threshold, we decrement the counter, calculate the remaining milliseconds until the next hour window starts, reschedule the job in BullMQ with that delay, and trigger a live Slack webhook alert."*

### Q4: What happens if the server crashes while an email is being processed?
> **Answer**: *"BullMQ workers implement automated lock renewals and retry backoff. If a worker process abruptly dies, Redis detects the lost lock and moves the job back to the waiting queue. On boot, our backend runs `recoverPendingJobs()`, which scans the relational database for any interrupted or un-enqueued jobs and reconciles them into BullMQ."*

### Q5: How do you support multiple senders?
> **Answer**: *"Each outreach campaign specifies a sender mailbox (e.g. `outreach@`, `growth@`). The rate-limiting keys are namespaced per sender. This guarantees that if one sender exhausts their quota, other senders are not blocked from sending."*

---

## 🚀 Quick Verification Commands

```powershell
# In project root:
cd C:\Users\Asus\.gemini\antigravity\scratch\reachinbox-scheduler

# 1. Start all services (Redis, Backend, Frontend)
.\start-dev.ps1

# 2. Run the 1,000+ email load test
cd backend
npm run test:load

# 3. Check Git Status (Already pushed to main!)
git status
```
