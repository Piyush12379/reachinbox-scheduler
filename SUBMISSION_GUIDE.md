# 📋 ReachInbox Assignment Submission & Demo Video Guide

Follow this step-by-step checklist to submit your assignment for Outbox Labs (ReachInbox) and record your demo video with captions.

---

## 🕒 1. Submission Details & Deadlines
* **Company**: Outbox Labs / ReachInbox.ai
* **Role**: Software Development Engineer (SDE) - Intern
* **Submission Form**: [ClickUp Submission Form](https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST)
* **GitHub Access Required**: Add collaborators `mitrajit` and `Yadav036` to your private repo.

---

## 📦 2. Pushing Code to Your GitHub Repository

Run the following commands in PowerShell from the `reachinbox-scheduler` folder:

```powershell
cd C:\Users\Asus\.gemini\antigravity\scratch\reachinbox-scheduler

# Initialize Git
git init
git add .
git commit -m "feat: complete ReachInbox full-stack email job scheduler with BullMQ, Redis, Ethereal SMTP, and Slack alerts"

# Link to your new private GitHub repository (create it on github.com first)
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/reachinbox-email-scheduler.git
git push -u origin main
```

### Adding Collaborators on GitHub:
1. Go to your repository on GitHub.
2. Click **Settings** > **Collaborators** > **Add people**.
3. Search and invite:
   - `mitrajit`
   - `Yadav036`

---

## 🎥 3. 5-Minute Demo Video Script (With Captions)

Use screen recording software (e.g. OBS Studio, Loom, or Windows Game Bar `Win + Alt + R`).
Enable captions or add text subtitles on screen describing what you are doing.

### ⏱️ Timestamp Breakdown (Total ~4:30):

#### 0:00 - 0:45 | Introduction & Architecture Overview
* **Action**: Show `README.md` diagram and browser open to `http://localhost:3000`.
* **Caption / Voiceover**:
  > *"Hello, my name is Piyush Raj. Today I am presenting my submission for the ReachInbox Full-Stack Email Job Scheduler. Here is our architecture: React + TypeScript frontend, Express backend, BullMQ delayed queue backed by Redis with zero cron jobs, Ethereal fake SMTP, Prisma database persistence, and live Slack webhook rate-limit alerts."*

#### 0:45 - 1:45 | Composing Outreach & CSV Lead Parsing
* **Action**: Click **"Compose New Email"** in the UI. Drag and drop `demo-dataset.csv`.
* **Caption / Voiceover**:
  > *"First, I open the Compose modal and upload a CSV file containing 10 leads. The frontend parser immediately extracts and dedupes all 10 leads. I insert a personalized cold email sequence, set a 2-second throttle delay between emails, and configure the hourly rate limit. Clicking 'Schedule Campaign' stores the records in our relational database and queues delayed jobs in BullMQ."*

#### 1:45 - 2:45 | Real-Time Execution, Tables & Ethereal Previews
* **Action**: Show **Scheduled Emails** tab. As jobs execute, switch to **Sent Emails** tab. Click **"View in Ethereal"**.
* **Caption / Voiceover**:
  > *"In the Scheduled tab, we see all jobs queued with staggered start times. As our 5-worker concurrent engine processes the jobs, their status transitions to PROCESSING and SENT. In the Sent tab, each dispatched email has a live Ethereal preview URL. Clicking it opens the real fake SMTP message rendered in Ethereal's webmail."*

#### 2:45 - 3:30 | Server Crash & Restart Persistence Scenario
* **Action**: Schedule 3 emails with a 1-minute delay. Go to terminal, stop the backend server (`Ctrl + C`). Wait 5 seconds, then restart with `npm run dev`.
* **Caption / Voiceover**:
  > *"Next, I demonstrate persistence on restart. I schedule 3 emails for 1 minute in the future. Now, I kill the backend server. The jobs are preserved in Redis and SQLite. When I restart the server, the startup reconciler logs: 'Reconciliation complete: verified and restored.' When the scheduled time arrives, all future emails are dispatched at the correct time with zero duplicates."*

#### 3:30 - 4:15 | Rate Limiting & Live Slack Notification
* **Action**: Open the **Connect Slack** modal. Show the connection status. Schedule 5 emails with an hourly limit of 2.
* **Caption / Voiceover**:
  > *"Finally, here is our Redis-backed sliding window rate limiter. We set an hourly limit of 2. The first 2 emails send immediately. On the 3rd email, the worker detects the limit is reached, does not drop or fail the job, but reschedules it to the next hour window and triggers a live alert in Slack showing the sender, current count, and rescheduled time."*

#### 4:15 - 4:30 | BullMQ Dashboard & Conclusion
* **Action**: Switch to `http://localhost:5000/admin/queues` showing Bull-board UI.
* **Caption / Voiceover**:
  > *"Here is our live BullMQ queue dashboard showing real-time active, delayed, and completed jobs. Thank you Outbox Labs team for reviewing my assignment!"*

---

## 📝 4. Final Submission Checklist

- [x] Code pushed to private GitHub repository
- [x] Invited `mitrajit` and `Yadav036` as collaborators
- [x] Tested BullMQ delayed jobs (Zero cron)
- [x] Tested Server restart persistence
- [x] Tested Ethereal SMTP with preview URLs
- [x] Tested Rate Limiting & Slack Webhook alert
- [x] Tested Bull-Board Dashboard at `/admin/queues`
- [x] Recorded 5-minute demo video with captions
- [x] Submitted details via the [ClickUp Form](https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST)
