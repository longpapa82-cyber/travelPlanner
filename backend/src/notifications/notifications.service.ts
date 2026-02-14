import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
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
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      body,
      data,
    });
    const saved = await this.notificationRepository.save(notification);

    // Also send push notification
    await this.sendPushToUser(userId, title, body, data);

    return saved;
  }

  async createForMultipleUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const notifications = userIds.map((userId) =>
      this.notificationRepository.create({ userId, type, title, body, data }),
    );
    await this.notificationRepository.save(notifications);

    // Send push notifications
    await this.sendPushToMultipleUsers(userIds, title, body, data);
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return { notifications, total };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async delete(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepository.delete({ id: notificationId, userId });
  }

  async deleteAll(userId: string): Promise<void> {
    await this.notificationRepository.delete({ userId });
  }

  // Push notification methods (migrated from common/notification.service.ts)

  async registerPushToken(userId: string, token: string) {
    await this.userRepository.update(userId, { pushToken: token });
    this.logger.log(`Push token registered for user ${userId}`);
  }

  async removePushToken(userId: string) {
    await this.userRepository.update(userId, { pushToken: undefined });
  }

  private async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.pushToken) return;

    await this.sendPushNotifications([
      { to: user.pushToken, title, body, data, sound: 'default' },
    ]);
  }

  private async sendPushToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    if (userIds.length === 0) return;

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

      await response.json();
      this.logger.log(`Push sent: ${messages.length} messages`);
    } catch (error) {
      this.logger.error('Failed to send push notifications', error);
    }
  }
}
