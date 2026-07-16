# WhatsApp Automation Scheduler Trigger Setup

This document describes how the automated WhatsApp queue (abandoned cart sequences, template retry queue) is triggered in production.

## Architecture

The endpoint `/api/cron/whatsapp-scheduler` processes campaigns, standard message retries, campaign recipient retries, and automated cart recoveries.

Because this application is deployed on **DigitalOcean App Platform**:
1. DigitalOcean App Platform's native **Scheduled Jobs** support a minimum cron interval of **15 minutes**.
2. To satisfy the business requirement of processing the queue every **1–2 minutes**, we run a lightweight Node daemon pinger as a **Worker** component OR use an external cron scheduler.

---

## Option 1: DigitalOcean App Platform Worker (Recommended)

You can define a worker component in your `app.yaml` (App Spec) file that runs continuously, executing the pinger loop script `scripts/whatsapp-scheduler-pinger.js`.

### 1. App Spec Configuration
Add the following `worker` block to your DigitalOcean App Spec configuration:

```yaml
workers:
  - name: whatsapp-scheduler-pinger
    run_command: node scripts/whatsapp-scheduler-pinger.js
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs # Minimum size (very cheap)
    envs:
      - key: CRON_SECRET
        scope: RUN_TIME
        value: "${CRON_SECRET}"
      - key: NEXT_PUBLIC_APP_URL
        scope: RUN_TIME
        value: "https://app.zicabella.com"
```

### 2. Required Env Variables
Make sure both variables are configured in the App Platform settings:
- `CRON_SECRET`: A secure random secret string.
- `NEXT_PUBLIC_APP_URL`: `https://app.zicabella.com`

---

## Option 2: External Scheduled Pinger (Alternative)

If you prefer to avoid the cost of an always-on DigitalOcean worker container, you can use a dedicated external scheduled pinger:

1. **UptimeRobot / Cron-Job.org**:
   - Create a HTTP/GET cron monitor that requests:
     `https://app.zicabella.com/api/cron/whatsapp-scheduler?secret=YOUR_CRON_SECRET`
   - Set the execution frequency to **every 1 minute** or **every 2 minutes**.
   - Configure a timeout of 30 seconds.

---

## Verification & Auditing

Every time the scheduler runs, it creates a row in the database `whatsapp_scheduler_runs` table, storing:
- `createdAt`: Execution time
- `campaignsProcessed`: Number of campaigns dispatched
- `campaignRecipientsRetried`: Number of failed campaign recipients retried
- `messagesRetried`: Number of standard messages retried
- `abandonedCartStep1Sent` / `Step2Sent` / `Step3Sent`: Abandoned cart notifications sent
- `success`: Whether the run succeeded
- `errorCount` and `errors`: Error logs if any exceptions occurred

These logs power the health panel on the **WhatsApp Hub** admin interface, rendering recent run metrics and template statistics.
