import admin from 'firebase-admin';
import db from '../db'; // Assuming standard Prisma client export

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const NotificationService = {
  /**
   * Registers or updates a device token for a user
   */
  async registerDeviceToken(data: { userId: string; deviceId: string; fcmToken: string; platform?: string; appVersion?: string }) {
    return db.deviceToken.upsert({
      where: {
        userId_deviceId: {
          userId: data.userId,
          deviceId: data.deviceId,
        },
      },
      update: {
        fcmToken: data.fcmToken,
        platform: data.platform || 'ios',
        appVersion: data.appVersion,
        isActive: true,
      },
      create: {
        userId: data.userId,
        deviceId: data.deviceId,
        fcmToken: data.fcmToken,
        platform: data.platform || 'ios',
        appVersion: data.appVersion,
        isActive: true,
      },
    });
  },

  /**
   * Soft deletes a device token
   */
  async unregisterDevice(userId: string, deviceId: string) {
    return db.deviceToken.update({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
      data: {
        isActive: false,
      },
    });
  },

  /**
   * Sends a notification to a specific user using FCM multicast
   */
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    const devices = await db.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (devices.length === 0) {
      return { success: false, reason: 'No active devices found for user.' };
    }

    const tokens = devices.map(d => d.fcmToken);

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title,
        body,
      },
      data,
      tokens,
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1, // You could calculate exact badge count here if needed
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      
      // Cleanup stale tokens
      const tokensToRemove: string[] = [];
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errorCode = res.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            tokensToRemove.push(tokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        await db.deviceToken.updateMany({
          where: { fcmToken: { in: tokensToRemove } },
          data: { isActive: false },
        });
      }

      return { 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount 
      };
    } catch (error) {
      console.error('Error sending push notification to user:', error);
      throw error;
    }
  },

  /**
   * Send notification to an array of user IDs (batches of 500)
   */
  async sendToSegment(userIds: string[], title: string, body: string, data?: Record<string, string>) {
     // Fetch all active tokens for these users
     const devices = await db.deviceToken.findMany({
        where: {
            userId: { in: userIds },
            isActive: true
        }
     });

     const tokens = devices.map(d => d.fcmToken);
     return this.sendToTokens(tokens, title, body, data);
  },

  /**
   * Helper to send to arbitrary tokens with 500-chunk limits
   */
  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>) {
      if (tokens.length === 0) return { success: true, successCount: 0, failureCount: 0 };

      let successCount = 0;
      let failureCount = 0;
      
      // Firebase limits to 500 tokens per multicast
      for (let i = 0; i < tokens.length; i += 500) {
          const chunk = tokens.slice(i, i + 500);
          const message: admin.messaging.MulticastMessage = {
            notification: { title, body },
            data,
            tokens: chunk,
            apns: {
              payload: { aps: { sound: 'default', badge: 1 } },
            },
          };

          try {
              const response = await admin.messaging().sendEachForMulticast(message);
              successCount += response.successCount;
              failureCount += response.failureCount;

              // Cleanup
              const tokensToRemove: string[] = [];
              response.responses.forEach((res, idx) => {
                  if (!res.success && (res.error?.code === 'messaging/invalid-registration-token' || res.error?.code === 'messaging/registration-token-not-registered')) {
                      tokensToRemove.push(chunk[idx]);
                  }
              });

              if (tokensToRemove.length > 0) {
                  await db.deviceToken.updateMany({
                      where: { fcmToken: { in: tokensToRemove } },
                      data: { isActive: false }
                  });
              }
          } catch(err) {
              console.error('Error sending multicast chunk:', err);
              // continue sending next chunks even if one fails
          }
      }

      return { success: true, successCount, failureCount };
  }
};
