import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';

// Mock global fetch for Expo push API
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockNotificationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });
  });

  const mockNotification: Partial<Notification> = {
    id: 'notif-1',
    userId: 'user-1',
    type: NotificationType.TRIP_STARTED,
    title: 'Trip Started',
    body: 'Your trip to Tokyo has started!',
    isRead: false,
    createdAt: new Date(),
  };

  // ── create ──

  describe('create', () => {
    it('should create a notification and send push', async () => {
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1',
        pushToken: 'ExponentPushToken[xxx]',
      });

      const result = await service.create(
        'user-1',
        NotificationType.TRIP_STARTED,
        'Trip Started',
        'Your trip has started!',
      );

      expect(mockNotificationRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NotificationType.TRIP_STARTED,
        title: 'Trip Started',
        body: 'Your trip has started!',
        data: undefined,
      });
      expect(mockNotificationRepo.save).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual(mockNotification);
    });

    it('should create notification without push when user has no token', async () => {
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', pushToken: null });

      await service.create(
        'user-1',
        NotificationType.TRIP_STARTED,
        'Title',
        'Body',
      );

      expect(mockNotificationRepo.save).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should include data in notification', async () => {
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', pushToken: null });

      await service.create(
        'user-1',
        NotificationType.TRIP_UPDATED,
        'Updated',
        'Trip updated',
        { tripId: 'trip-123' },
      );

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { tripId: 'trip-123' } }),
      );
    });
  });

  // ── createForMultipleUsers ──

  describe('createForMultipleUsers', () => {
    it('should create notifications for multiple users', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'user-1', pushToken: 'token-1' },
          { id: 'user-2', pushToken: 'token-2' },
        ]),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockNotificationRepo.create.mockImplementation((data) => data);
      mockNotificationRepo.save.mockResolvedValue([]);

      await service.createForMultipleUsers(
        ['user-1', 'user-2'],
        NotificationType.TRIP_UPDATED,
        'Update',
        'Trip updated',
      );

      expect(mockNotificationRepo.create).toHaveBeenCalledTimes(2);
      expect(mockNotificationRepo.save).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody).toHaveLength(2);
    });

    it('should skip push when no users have tokens', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockNotificationRepo.create.mockImplementation((data) => data);
      mockNotificationRepo.save.mockResolvedValue([]);

      await service.createForMultipleUsers(
        ['user-1'],
        NotificationType.TRIP_UPDATED,
        'Title',
        'Body',
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── findByUser ──

  describe('findByUser', () => {
    it('should return paginated notifications', async () => {
      const notifications = [mockNotification];
      mockNotificationRepo.findAndCount.mockResolvedValue([notifications, 1]);

      const result = await service.findByUser('user-1', 1, 20);

      expect(result).toEqual({ notifications, total: 1 });
      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should calculate skip correctly for page 2', async () => {
      mockNotificationRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByUser('user-1', 2, 10);

      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should use default values when not provided', async () => {
      mockNotificationRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByUser('user-1');

      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ── getUnreadCount ──

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      mockNotificationRepo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(5);
      expect(mockNotificationRepo.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });
  });

  // ── markAsRead / markAllAsRead ──

  describe('markAsRead', () => {
    it('should mark a specific notification as read', async () => {
      await service.markAsRead('user-1', 'notif-1');

      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { id: 'notif-1', userId: 'user-1' },
        { isRead: true },
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      await service.markAllAsRead('user-1');

      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        { isRead: true },
      );
    });
  });

  // ── delete / deleteAll ──

  describe('delete', () => {
    it('should delete a specific notification', async () => {
      await service.delete('user-1', 'notif-1');

      expect(mockNotificationRepo.delete).toHaveBeenCalledWith({
        id: 'notif-1',
        userId: 'user-1',
      });
    });
  });

  describe('deleteAll', () => {
    it('should delete all notifications for a user', async () => {
      await service.deleteAll('user-1');

      expect(mockNotificationRepo.delete).toHaveBeenCalledWith({
        userId: 'user-1',
      });
    });
  });

  // ── registerPushToken / removePushToken ──

  describe('registerPushToken', () => {
    it('should update user push token', async () => {
      await service.registerPushToken('user-1', 'ExponentPushToken[abc]');

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        pushToken: 'ExponentPushToken[abc]',
      });
    });
  });

  describe('removePushToken', () => {
    it('should clear user push token', async () => {
      await service.removePushToken('user-1');

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        pushToken: undefined,
      });
    });
  });

  // ── Push notification edge cases ──

  describe('push notification error handling', () => {
    it('should not throw when Expo API fails', async () => {
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1',
        pushToken: 'token',
      });
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Should not throw — errors are caught internally
      await expect(
        service.create(
          'user-1',
          NotificationType.TRIP_STARTED,
          'Title',
          'Body',
        ),
      ).resolves.toBeDefined();
    });

    it('should not send push when user not found', async () => {
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);
      mockUserRepo.findOne.mockResolvedValue(null);

      await service.create(
        'user-1',
        NotificationType.TRIP_STARTED,
        'Title',
        'Body',
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip bulk push for empty userIds', async () => {
      mockNotificationRepo.create.mockImplementation((data) => data);
      mockNotificationRepo.save.mockResolvedValue([]);

      await service.createForMultipleUsers(
        [],
        NotificationType.TRIP_UPDATED,
        'Title',
        'Body',
      );

      expect(mockUserRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
