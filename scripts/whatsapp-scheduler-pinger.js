/**
 * WhatsApp Scheduler Continuous Pinger Daemon
 * Location: scripts/whatsapp-scheduler-pinger.js
 * 
 * This daemon is designed to run as an always-on background worker in production
 * (e.g. on DigitalOcean App Platform) or as an external cron script.
 * It pings the scheduler API endpoint every 2 minutes to trigger the automation queue.
 */

const cronSecret = process.env.CRON_SECRET;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zicabella.com';

if (!cronSecret) {
  console.error('[Scheduler Pinger] Error: CRON_SECRET environment variable is not defined.');
  process.exit(1);
}

const url = `${appUrl.replace(/\/$/, '')}/api/cron/whatsapp-scheduler?secret=${encodeURIComponent(cronSecret)}`;

console.log(`[Scheduler Pinger] Initialized. Target URL: ${appUrl}/api/cron/whatsapp-scheduler (Secret: [HIDDEN])`);

async function triggerScheduler() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Pinging WhatsApp scheduler queue...`);
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ZicaBellaSchedulerPinger/1.0'
      }
    });

    const status = res.status;
    let data;
    try {
      data = await res.json();
    } catch {
      data = { error: 'Invalid JSON response' };
    }

    if (res.ok) {
      console.log(`[${new Date().toISOString()}] Success (Status ${status}):`, JSON.stringify(data.results || data));
    } else {
      console.error(`[${new Date().toISOString()}] Failed (Status ${status}):`, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Network Error triggering scheduler:`, err.message);
  }
}

// Run immediately on boot
triggerScheduler();

// Run every 2 minutes (120,000 milliseconds)
setInterval(triggerScheduler, 120000);
