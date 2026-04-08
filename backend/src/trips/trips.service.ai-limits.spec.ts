import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { TripsService } from './trips.service';
import { Trip } from './entities/trip.entity';
import { Itinerary } from './entities/itinerary.entity';
import { Collaborator } from './entities/collaborator.entity';
import { AIService } from './services/ai.service';
import { TimezoneService } from './services/timezone.service';
import { WeatherService } from './services/weather.service';
import { TripStatusScheduler } from './trip-status.scheduler';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateTripDto } from './dto/create-trip.dto';

describe('TripsService - AI Generation Limits', () => {
  let service: TripsService;
  let mockQueryRunner: any;

  const createMockQueryRunner = (userData: any) => {
    return {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn().mockImplementation((_entity, data) => ({
          ...data,
          id: 'generated-id',
        })),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue(userData),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        }),
      },
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        {
          provide: getRepositoryToken(Trip),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn().mockImplementation(({ where }) => {
              // Return a matching trip for owner check in findOne()
              return Promise.resolve({
                id: where?.id || 'generated-id',
                userId: where?.userId || 'test-user-id',
                destination: 'Test Destination',
                status: 'upcoming',
                itineraries: [],
              });
            }),
            save: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            manager: {
              transaction: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(Itinerary),
          useValue: {
            save: jest.fn(),
            create: jest.fn().mockImplementation((data) => data),
          },
        },
        {
          provide: getRepositoryToken(Collaborator),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AIService,
          useValue: {
            generateAllItineraries: jest.fn().mockResolvedValue([
              {
                day: 1,
                date: '2024-06-01',
                title: 'Day 1',
                description: 'Test day',
                timezoneOffset: 60,
                activities: [],
              },
            ]),
          },
        },
        {
          provide: TimezoneService,
          useValue: {
            getLocationInfo: jest.fn().mockResolvedValue({
              latitude: 48.8566,
              longitude: 2.3522,
              formattedAddress: 'Paris, France',
            }),
            getTimezoneInfo: jest.fn().mockResolvedValue({
              timezone: 'Europe/Paris',
              timezoneId: 'Europe/Paris',
              timezoneOffset: 2,
              localTime: '2024-06-01T12:00:00',
            }),
          },
        },
        {
          provide: WeatherService,
          useValue: {
            getWeatherForDateRange: jest.fn().mockResolvedValue(new Map()),
          },
        },
        {
          provide: TripStatusScheduler,
          useValue: {
            validateAndUpdateTripStatus: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
            createForMultipleUsers: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SubscriptionService,
          useValue: {
            checkAiTripLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 3 }),
            incrementAiTripCount: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TripsService>(TripsService);

    // Set default environment variables for testing
    process.env.AI_TRIPS_FREE_LIMIT = '3';
    process.env.AI_TRIPS_PREMIUM_LIMIT = '30';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.AI_TRIPS_FREE_LIMIT;
    delete process.env.AI_TRIPS_PREMIUM_LIMIT;
  });

  describe('Admin Users', () => {
    it('should allow unlimited AI generations for admin users', async () => {
      const adminUserData = {
        users_id: 'admin-user-id',
        users_aiTripsUsedThisMonth: 100, // Already has many trips
        users_subscriptionTier: 'free',
        users_role: 'admin',
      };

      mockQueryRunner = createMockQueryRunner(adminUserData);
      const dataSource = service['dataSource'];
      dataSource.createQueryRunner = jest.fn().mockReturnValue(mockQueryRunner);

      const createTripDto: CreateTripDto = {
        destination: 'Paris, France',
        country: 'France',
        city: 'Paris',
        startDate: '2024-06-01',
        endDate: '2024-06-05',
        numberOfTravelers: 2,
        preferences: {
          budget: 'medium',
          travelStyle: 'cultural',
          interests: ['museums', 'food'],
        },
      };

      // Should not throw even though the count is high
      await expect(
        service.create('admin-user-id', createTripDto, 'ko'),
      ).resolves.toBeDefined();

      // Should NOT increment the AI trips counter for admin
      const updateCalls = mockQueryRunner.manager
        .createQueryBuilder()
        .update.mock.calls;
      const aiTripsUpdateCall = updateCalls.find((call) =>
        JSON.stringify(call).includes('aiTripsUsedThisMonth'),
      );
      expect(aiTripsUpdateCall).toBeUndefined();
    });
  });

  describe('Premium Users', () => {
    it('should allow up to 30 AI generations for premium users', async () => {
      const premiumUserData = {
        users_id: 'premium-user-id',
        users_aiTripsUsedThisMonth: 29,
        users_subscriptionTier: 'premium',
        users_role: 'user',
      };

      mockQueryRunner = createMockQueryRunner(premiumUserData);
      const dataSource = service['dataSource'];
      dataSource.createQueryRunner = jest.fn().mockReturnValue(mockQueryRunner);

      const createTripDto: CreateTripDto = {
        destination: 'Tokyo, Japan',
        country: 'Japan',
        city: 'Tokyo',
        startDate: '2024-07-01',
        endDate: '2024-07-07',
        numberOfTravelers: 1,
        preferences: {
          budget: 'high',
          travelStyle: 'adventure',
          interests: ['tech', 'culture'],
        },
      };

      // Should not throw as premium user has 30 trip limit
      await expect(
        service.create('premium-user-id', createTripDto, 'ko'),
      ).resolves.toBeDefined();

      // Should increment the AI trips counter
      const updateCalls = mockQueryRunner.manager
        .createQueryBuilder()
        .update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should throw error when premium user exceeds 30 AI generations', async () => {
      const premiumUserData = {
        users_id: 'premium-user-id',
        users_aiTripsUsedThisMonth: 30,
        users_subscriptionTier: 'premium',
        users_role: 'user',
      };

      mockQueryRunner = createMockQueryRunner(premiumUserData);
      const dataSource = service['dataSource'];
      dataSource.createQueryRunner = jest.fn().mockReturnValue(mockQueryRunner);

      const createTripDto: CreateTripDto = {
        destination: 'London, UK',
        country: 'UK',
        city: 'London',
        startDate: '2024-08-01',
        endDate: '2024-08-05',
        numberOfTravelers: 2,
        preferences: {
          budget: 'medium',
          travelStyle: 'cultural',
          interests: ['history', 'museums'],
        },
      };

      await expect(
        service.create('premium-user-id', createTripDto, 'ko'),
      ).rejects.toThrow(
        new ForbiddenException(
          'Premium monthly AI generation limit (30) reached. Try manual creation or wait until next month.',
        ),
      );
    });
  });

  describe('Free Users', () => {
    it('should allow up to 3 AI generations for free users', async () => {
      const freeUserData = {
        users_id: 'free-user-id',
        users_aiTripsUsedThisMonth: 2,
        users_subscriptionTier: 'free',
        users_role: 'user',
      };

      mockQueryRunner = createMockQueryRunner(freeUserData);
      const dataSource = service['dataSource'];
      dataSource.createQueryRunner = jest.fn().mockReturnValue(mockQueryRunner);

      const createTripDto: CreateTripDto = {
        destination: 'Barcelona, Spain',
        country: 'Spain',
        city: 'Barcelona',
        startDate: '2024-09-01',
        endDate: '2024-09-05',
        numberOfTravelers: 2,
        preferences: {
          budget: 'low',
          travelStyle: 'relaxation',
          interests: ['beach', 'food'],
        },
      };

      // Should not throw as free user has not reached 3 trip limit
      await expect(
        service.create('free-user-id', createTripDto, 'ko'),
      ).resolves.toBeDefined();

      // Should increment the AI trips counter
      const updateCalls = mockQueryRunner.manager
        .createQueryBuilder()
        .update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should throw error when free user exceeds 3 AI generations', async () => {
      const freeUserData = {
        users_id: 'free-user-id',
        users_aiTripsUsedThisMonth: 3,
        users_subscriptionTier: 'free',
        users_role: 'user',
      };

      mockQueryRunner = createMockQueryRunner(freeUserData);
      const dataSource = service['dataSource'];
      dataSource.createQueryRunner = jest.fn().mockReturnValue(mockQueryRunner);

      const createTripDto: CreateTripDto = {
        destination: 'Rome, Italy',
        country: 'Italy',
        city: 'Rome',
        startDate: '2024-10-01',
        endDate: '2024-10-05',
        numberOfTravelers: 2,
        preferences: {
          budget: 'medium',
          travelStyle: 'cultural',
          interests: ['history', 'food'],
        },
      };

      await expect(
        service.create('free-user-id', createTripDto, 'ko'),
      ).rejects.toThrow(
        new ForbiddenException(
          'Monthly AI generation limit (3) reached. Try manual creation or wait until next month.',
        ),
      );
    });
  });

  describe('Manual Mode', () => {
    it('should not check AI limits for manual mode trips', async () => {
      // No user data needed for manual mode
      mockQueryRunner = createMockQueryRunner(null);
      const dataSource = service['dataSource'];
      dataSource.createQueryRunner = jest.fn().mockReturnValue(mockQueryRunner);

      const createTripDto: CreateTripDto = {
        destination: 'Berlin, Germany',
        country: 'Germany',
        city: 'Berlin',
        startDate: '2024-11-01',
        endDate: '2024-11-05',
        numberOfTravelers: 2,
        planningMode: 'manual',
        preferences: {
          budget: 'medium',
          travelStyle: 'cultural',
          interests: ['history', 'art'],
        },
      };

      // Should not check limits or increment counter in manual mode
      await expect(
        service.create('any-user-id', createTripDto, 'ko'),
      ).resolves.toBeDefined();

      // Should not have queried for user data
      const getRawOneCalls =
        mockQueryRunner.manager.createQueryBuilder().getRawOne.mock.calls;
      expect(getRawOneCalls.length).toBe(0);
    });
  });
});