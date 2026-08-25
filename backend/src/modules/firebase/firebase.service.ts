import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Wraps the Firebase Admin SDK for push notifications. DEMOTED per owner
 * policy (T6): standards-based VAPID web push is THE notification channel;
 * FCM stays available only behind an explicit `FCM_ENABLED=true` plus service
 * account credentials. Initialisation is skipped (with a warning) otherwise,
 * so the app still boots without any Google account.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    try {
      if (String(this.configService.get<string>('FCM_ENABLED', 'false')).toLowerCase() !== 'true') {
        this.logger.log('FCM disabled (FCM_ENABLED=false) — browser push uses VAPID web push');
        return;
      }
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const privateKey = this.configService
        .get<string>('FIREBASE_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n'); // service-account keys arrive with escaped newlines
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

      if (!projectId || !privateKey || !clientEmail) {
        this.logger.warn('Firebase credentials not configured. Push notifications will not work.');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });

      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  private buildMessage(
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Omit<admin.messaging.TokenMessage, 'token'> {
    return {
      notification: { title, body },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };
  }

  /** Sends a push notification to a single device token. */
  async sendToDevice(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      const message = {
        ...this.buildMessage(title, body, data),
        token: fcmToken,
      };
      const response = await admin.messaging().send(message);
      this.logger.debug(`Push notification sent: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      return false;
    }
  }

  /** Sends a push notification to many device tokens; returns the success count. */
  async sendToMultipleDevices(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<number> {
    try {
      const message: admin.messaging.MulticastMessage = {
        ...this.buildMessage(title, body, data),
        tokens: fcmTokens,
      };
      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.debug(`Sent ${response.successCount}/${fcmTokens.length} push notifications`);
      return response.successCount;
    } catch (error) {
      this.logger.error(`Failed to send multicast push notification: ${error.message}`);
      return 0;
    }
  }

  /** Sends a push notification to every device subscribed to a topic. */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      const message: admin.messaging.Message = {
        ...this.buildMessage(title, body, data),
        topic,
        android: {
          priority: 'high',
        },
      };
      const response = await admin.messaging().send(message);
      this.logger.debug(`Push notification sent to topic ${topic}: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification to topic: ${error.message}`);
      return false;
    }
  }

  /** Subscribes device tokens to a topic. */
  async subscribeToTopic(fcmTokens: string[], topic: string): Promise<boolean> {
    try {
      await admin.messaging().subscribeToTopic(fcmTokens, topic);
      this.logger.debug(`Subscribed ${fcmTokens.length} devices to topic: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic: ${error.message}`);
      return false;
    }
  }
}
