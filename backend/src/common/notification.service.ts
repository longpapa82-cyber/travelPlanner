import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async registerPushToken(userId: string, token: string) {
    await this.userRepository.update(userId, { pushToken: token });
    this.logger.log(`Push token registered for user ${userId}`);
  }

  async removePushToken(userId: string) {
    await this.userRepository.update(userId, { pushToken: undefined });
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.pushToken) return;

    await this.sendPushNotification({
      to: user.pushToken,
      title,
      body,
      data,
      sound: 'default',
    });
  }

  async sendToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids: userIds })
      .andWhere('user.pushToken IS NOT NULL')
      .getMany();

    const messages: ExpoPushMessage[] = users
      .filter((u) => u.pushToken)
      .map((u) => ({
        to: u.pushToken!,
        title,
        body,
        data,
        sound: 'default' as const,
      }));

    if (messages.length > 0) {
      await this.sendPushNotifications(messages);
    }
  }

  private async sendPushNotification(message: ExpoPushMessage) {
    return this.sendPushNotifications([message]);
  }

  private async sendPushNotifications(messages: ExpoPushMessage[]) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      this.logger.log(`Push sent: ${messages.length} messages`);
      return result;
    } catch (error) {
      this.logger.error('Failed to send push notifications', error);
    }
  }
}
