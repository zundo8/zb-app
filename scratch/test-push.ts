import { NotificationService } from '../lib/services/notification.service';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testNotification() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.log('Usage: npx ts-node scratch/test-push.ts <userId>');
    process.exit(1);
  }

  console.log(`\n🚀 Testing Push Notification for User: ${userId}`);
  console.log('-------------------------------------------');
  console.log(`APNS_KEY_ID: ${process.env.APNS_KEY_ID}`);
  console.log(`APNS_TEAM_ID: ${process.env.APNS_TEAM_ID}`);
  console.log(`APNS_BUNDLE_ID: ${process.env.APNS_BUNDLE_ID}`);
  console.log(`APNS_PRODUCTION: ${process.env.APNS_PRODUCTION}`);
  console.log('-------------------------------------------\n');

  try {
    const result = await NotificationService.sendToUser(
      userId,
      'Zica Bella Heartbeat 💓',
      'If you see this, your push notifications are fully functional!',
      { type: 'test', timestamp: new Date().toISOString() }
    );

    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ Success! The notification was handed off to the delivery services.');
    } else {
      console.log('\n❌ Failed:', (result as any).reason || 'Unknown error');
    }
  } catch (error: any) {
    console.error('\n💥 Critical Error:', error.message);
  }
}

testNotification();
