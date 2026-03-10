import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TripsService } from './trips.service';
import { Trip, TripStatus } from './entities/trip.entity';
import { Itinerary } from './entities/itinerary.entity';
import { Collaborator } from './entities/collaborator.entity';
import { AIService } from './services/ai.service';
import { TimezoneService } from './services/timezone.service';
import { WeatherService } from './services/weather.service';
import { TripStatusScheduler } from './trip-status.scheduler';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { SortBy, SortOrder } from './dto/query-trips.dto';

describe('TripsService', () => {
  let service: TripsService;
  let tripRepository: jest.Mocked<Repository<Trip>>;
  let itineraryRepository: jest.Mocked<Repository<Itinerary>>;
  let aiService: jest.Mocked<AIService>;
  let timezoneService: jest.Mocked<TimezoneService>;
  let weatherService: jest.Mocked<WeatherService>;
  let tripStatusScheduler: jest.Mocked<TripStatusScheduler>;

  const mockUserId = 'user-123';
  const mockTripId = 'trip-456';
  const mockItineraryId = 'itinerary-789';

  const mockTrip: Partial<Trip> = {
    id: mockTripId,
    userId: mockUserId,
    destination: 'Paris, France',
    country: 'France',
    city: 'Paris',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-05'),
    status: TripStatus.UPCOMING,
    numberOfTravelers: 2,
    preferences: {
      budget: 'medium',
      travelStyle: 'cultural',
      interests: ['museums', 'food'],
    },
    itineraries: [],
  };

  const mockItinerary: Partial<Itinerary> = {
    id: mockItineraryId,
    tripId: mockTripId,
    date: new Date('2024-06-01'),
    dayNumber: 1,
    activities: [
      {
        time: '09:00',
        title: 'Visit Eiffel Tower',
        description: 'Iconic landmark',
        location: 'Eiffel Tower',
        estimatedDuration: 120,
        estimatedCost: 25,
        type: 'sightseeing',
      },
    ],
    timezone: 'Europe/Paris',
    timezoneOffset: 2,
    weather: {
      temperature: 22,
      condition: 'Sunny',
      humidity: 60,
      windSpeed: 10,
    },
  };

  const mockLocationInfo = {
    latitude: 48.8566,
    longitude: 2.3522,
    formattedAddress: 'Paris, France',
  };

  const mockTimezoneInfo = {
    timezone: 'Europe/Paris',
    timezoneId: 'Europe/Paris',
    timezoneOffset: 2,
    localTime: '2024-06-01T12:00:00',
  };

  const mockWeatherData = {
    temperature: 22,
    condition: 'Sunny',
    humidity: 60,
    windSpeed: 10,
    icon: '01d',
  };
  const mockWeatherMap = new Map<number, any>([
    [1, mockWeatherData],
    [2, mockWeatherData],
    [3, mockWeatherData],
  ]);

  const mockAIItineraries = [
    {
      date: new Date('2024-06-01'),
      dayNumber: 1,
      activities: [
        {
          time: '09:00',
          title: 'Visit Eiffel Tower',
          description: 'Iconic landmark',
          location: 'Eiffel Tower',
          estimatedDuration: 120,
          estimatedCost: 25,
          type: 'sightseeing',
        },
      ],
    },
    {
      date: new Date('2024-06-02'),
      dayNumber: 2,
      activities: [
        {
          time: '10:00',
          title: 'Louvre Museum',
          description: 'World-famous art museum',
          location: 'Louvre',
          estimatedDuration: 180,
          estimatedCost: 17,
          type: 'museum',
        },
      ],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        {
          provide: getRepositoryToken(Trip),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Itinerary),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Collaborator),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: AIService,
          useValue: {
            generateAllItineraries: jest.fn(),
          },
        },
        {
          provide: TimezoneService,
          useValue: {
            getLocationInfo: jest.fn(),
            getTimezoneInfo: jest.fn(),
          },
        },
        {
          provide: WeatherService,
          useValue: {
            getWeatherForDateRange: jest.fn(),
          },
        },
        {
          provide: TripStatusScheduler,
          useValue: {
            validateAndUpdateTripStatus: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
            createForMultipleUsers: jest.fn().mockResolvedValue(undefined),
            registerPushToken: jest.fn().mockResolvedValue(undefined),
            removePushToken: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SubscriptionService,
          useValue: {
            checkAiTripLimit: jest
              .fn()
              .mockResolvedValue({ allowed: true, remaining: 3 }),
            incrementAiTripCount: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TripsService>(TripsService);
    tripRepository = module.get(getRepositoryToken(Trip));
    itineraryRepository = module.get(getRepositoryToken(Itinerary));
    aiService = module.get(AIService);
    timezoneService = module.get(TimezoneService);
    weatherService = module.get(WeatherService);
    tripStatusScheduler = module.get(TripStatusScheduler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
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

    it('should create trip with AI-generated itineraries successfully', async () => {
      const savedTrip = { ...mockTrip };
      const itineraries = [
        mockItinerary,
        { ...mockItinerary, id: 'itinerary-790', dayNumber: 2 },
      ];

      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(savedTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      timezoneService.getTimezoneInfo.mockResolvedValue(mockTimezoneInfo);
      aiService.generateAllItineraries.mockResolvedValue(mockAIItineraries);
      weatherService.getWeatherForDateRange.mockResolvedValue(mockWeatherMap);
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue(itineraries as any);
      tripRepository.findOne.mockResolvedValue({
        ...savedTrip,
        itineraries,
      } as Trip);

      const result = await service.create(mockUserId, createTripDto);

      expect(tripRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        ...createTripDto,
        numberOfTravelers: 2,
      });
      expect(tripRepository.save).toHaveBeenCalled();
      expect(timezoneService.getLocationInfo).toHaveBeenCalledWith(
        'Paris, France',
      );
      expect(aiService.generateAllItineraries).toHaveBeenCalled();
      expect(itineraryRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.itineraries).toBeDefined();
    });

    it('should calculate numberOfDays correctly', async () => {
      const savedTrip = { ...mockTrip };
      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(savedTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      timezoneService.getTimezoneInfo.mockResolvedValue(mockTimezoneInfo);
      aiService.generateAllItineraries.mockResolvedValue(mockAIItineraries);
      weatherService.getWeatherForDateRange.mockResolvedValue(mockWeatherMap);
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...savedTrip,
        itineraries: [],
      } as Trip);

      await service.create(mockUserId, createTripDto);

      // June 1 to June 5 = 5 days
      expect(aiService.generateAllItineraries).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      );
    });

    it('should default numberOfTravelers to 1 if not provided', async () => {
      const dtoWithoutTravelers = {
        ...createTripDto,
        numberOfTravelers: undefined,
      };
      const savedTrip = { ...mockTrip, numberOfTravelers: 1 };

      tripRepository.create.mockReturnValue(savedTrip as Trip);
      tripRepository.save.mockResolvedValue(savedTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      timezoneService.getTimezoneInfo.mockResolvedValue(mockTimezoneInfo);
      aiService.generateAllItineraries.mockResolvedValue(mockAIItineraries);
      weatherService.getWeatherForDateRange.mockResolvedValue(mockWeatherMap);
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...savedTrip,
        itineraries: [],
      } as Trip);

      await service.create(mockUserId, dtoWithoutTravelers);

      expect(tripRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          numberOfTravelers: 1,
        }),
      );
    });

    it('should fallback to empty itineraries when AI generation fails', async () => {
      const savedTrip = { ...mockTrip };
      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(savedTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      timezoneService.getTimezoneInfo.mockResolvedValue(mockTimezoneInfo);
      aiService.generateAllItineraries.mockRejectedValue(
        new Error('AI service unavailable'),
      );
      weatherService.getWeatherForDateRange.mockResolvedValue(mockWeatherMap);
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...savedTrip,
        itineraries: [],
      } as Trip);

      await service.create(mockUserId, createTripDto);

      expect(itineraryRepository.save).toHaveBeenCalled();
      const savedItineraries = itineraryRepository.save.mock
        .calls[0][0] as Itinerary[];
      expect(savedItineraries).toHaveLength(5); // 5 days
      expect(savedItineraries[0].activities).toEqual([]);
    });

    it('should continue when timezone service fails', async () => {
      const savedTrip = { ...mockTrip };
      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(savedTrip as Trip);
      timezoneService.getLocationInfo.mockRejectedValue(
        new Error('Timezone API error'),
      );
      aiService.generateAllItineraries.mockResolvedValue(mockAIItineraries);
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...savedTrip,
        itineraries: [],
      } as Trip);

      const result = await service.create(mockUserId, createTripDto);

      expect(result).toBeDefined();
      expect(timezoneService.getTimezoneInfo).not.toHaveBeenCalled();
    });

    it('should continue when weather service fails', async () => {
      const savedTrip = { ...mockTrip };
      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(savedTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      timezoneService.getTimezoneInfo.mockResolvedValue(mockTimezoneInfo);
      aiService.generateAllItineraries.mockResolvedValue(mockAIItineraries);
      weatherService.getWeatherForDateRange.mockRejectedValue(
        new Error('Weather API error'),
      );
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...savedTrip,
        itineraries: [],
      } as Trip);

      const result = await service.create(mockUserId, createTripDto);

      expect(result).toBeDefined();
      expect(weatherService.getWeatherForDateRange).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all trips for a user', async () => {
      const trips = [mockTrip, { ...mockTrip, id: 'trip-457' }];
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(trips),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      const result = await service.findAll(mockUserId);

      expect(tripRepository.createQueryBuilder).toHaveBeenCalledWith('trip');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        '(trip.userId = :userId OR collab.id IS NOT NULL)',
        { userId: mockUserId },
      );
      expect(result.trips).toHaveLength(2);
    });

    it('should filter trips by search term', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTrip]),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      const result = await service.findAll(mockUserId, { search: 'Paris' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(trip.destination ILIKE :search OR trip.description ILIKE :search OR trip.country ILIKE :search OR trip.city ILIKE :search)',
        { search: '%Paris%' },
      );
      expect(result).toBeDefined();
    });

    it('should filter trips by status', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTrip]),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      const result = await service.findAll(mockUserId, {
        status: TripStatus.UPCOMING,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'trip.status = :status',
        {
          status: TripStatus.UPCOMING,
        },
      );
      expect(result).toBeDefined();
    });

    it('should sort trips by destination', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTrip]),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      await service.findAll(mockUserId, {
        sortBy: SortBy.DESTINATION,
        order: SortOrder.ASC,
      });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'trip.destination',
        'ASC',
      );
    });

    it('should sort trips by createdAt', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTrip]),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      await service.findAll(mockUserId, {
        sortBy: SortBy.CREATED_AT,
        order: SortOrder.DESC,
      });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'trip.createdAt',
        'DESC',
      );
    });

    it('should default sort to startDate DESC', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTrip]),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      await service.findAll(mockUserId);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'trip.startDate',
        'DESC',
      );
    });

    it('should validate and update trip statuses', async () => {
      const trips = [mockTrip, { ...mockTrip, id: 'trip-457' }];
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(trips),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      await service.findAll(mockUserId);

      expect(
        tripStatusScheduler.validateAndUpdateTripStatus,
      ).toHaveBeenCalledTimes(2);
    });

    it('should sort itineraries by dayNumber', async () => {
      const tripWithItineraries = {
        ...mockTrip,
        itineraries: [
          { ...mockItinerary, dayNumber: 3 },
          { ...mockItinerary, dayNumber: 1 },
          { ...mockItinerary, dayNumber: 2 },
        ],
      };

      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([tripWithItineraries]),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      const result = await service.findAll(mockUserId);

      expect(result.trips[0].itineraries[0].dayNumber).toBe(1);
      expect(result.trips[0].itineraries[1].dayNumber).toBe(2);
      expect(result.trips[0].itineraries[2].dayNumber).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return a trip by id', async () => {
      const tripWithItineraries = { ...mockTrip, itineraries: [mockItinerary] };
      tripRepository.findOne.mockResolvedValue(tripWithItineraries as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      const result = await service.findOne(mockUserId, mockTripId);

      expect(tripRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTripId, userId: mockUserId },
        relations: ['itineraries'],
      });
      expect(result).toEqual(tripWithItineraries);
    });

    it('should throw NotFoundException when trip not found', async () => {
      tripRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(mockUserId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne(mockUserId, 'non-existent-id'),
      ).rejects.toThrow('Trip not found');
    });

    it('should validate and update trip status', async () => {
      const tripWithItineraries = { ...mockTrip, itineraries: [mockItinerary] };
      tripRepository.findOne.mockResolvedValue(tripWithItineraries as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      await service.findOne(mockUserId, mockTripId);

      expect(
        tripStatusScheduler.validateAndUpdateTripStatus,
      ).toHaveBeenCalledWith(tripWithItineraries);
    });

    it('should sort itineraries by dayNumber', async () => {
      const tripWithItineraries = {
        ...mockTrip,
        itineraries: [
          { ...mockItinerary, dayNumber: 3, timezoneOffset: 2 },
          { ...mockItinerary, dayNumber: 1, timezoneOffset: 2 },
          { ...mockItinerary, dayNumber: 2, timezoneOffset: 2 },
        ],
      };

      tripRepository.findOne.mockResolvedValue(tripWithItineraries as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      const result = await service.findOne(mockUserId, mockTripId);

      expect(result.itineraries[0].dayNumber).toBe(1);
      expect(result.itineraries[1].dayNumber).toBe(2);
      expect(result.itineraries[2].dayNumber).toBe(3);
    });

    it('should enforce user isolation - different user cannot access trip', async () => {
      tripRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('different-user-id', mockTripId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateTripDto: UpdateTripDto = {
      destination: 'Rome, Italy',
      description: 'Updated description',
    };

    it('should update a trip successfully', async () => {
      const existingTrip = { ...mockTrip, itineraries: [] };
      const updatedTrip = { ...existingTrip, ...updateTripDto };

      tripRepository.findOne.mockResolvedValueOnce(existingTrip as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);
      tripRepository.save.mockResolvedValue(updatedTrip as Trip);
      tripRepository.findOne.mockResolvedValueOnce(updatedTrip as Trip);

      const result = await service.update(
        mockUserId,
        mockTripId,
        updateTripDto,
      );

      expect(tripRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when trip not found', async () => {
      tripRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockUserId, 'non-existent-id', updateTripDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating completed trip', async () => {
      const completedTrip = {
        ...mockTrip,
        status: TripStatus.COMPLETED,
        itineraries: [],
      };
      tripRepository.findOne.mockResolvedValue(completedTrip as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      await expect(
        service.update(mockUserId, mockTripId, updateTripDto),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.update(mockUserId, mockTripId, updateTripDto),
      ).rejects.toThrow(
        'Cannot modify completed trips. Completed trips are read-only.',
      );
    });

    it('should allow updating upcoming trips', async () => {
      const upcomingTrip = {
        ...mockTrip,
        status: TripStatus.UPCOMING,
        itineraries: [],
      };
      const updatedTrip = { ...upcomingTrip, ...updateTripDto };

      tripRepository.findOne.mockResolvedValueOnce(upcomingTrip as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);
      tripRepository.save.mockResolvedValue(updatedTrip as Trip);
      tripRepository.findOne.mockResolvedValueOnce(updatedTrip as Trip);

      const result = await service.update(
        mockUserId,
        mockTripId,
        updateTripDto,
      );

      expect(result).toBeDefined();
      expect(tripRepository.save).toHaveBeenCalled();
    });

    it('should allow updating ongoing trips', async () => {
      const ongoingTrip = {
        ...mockTrip,
        status: TripStatus.ONGOING,
        itineraries: [],
      };
      const updatedTrip = { ...ongoingTrip, ...updateTripDto };

      tripRepository.findOne.mockResolvedValueOnce(ongoingTrip as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);
      tripRepository.save.mockResolvedValue(updatedTrip as Trip);
      tripRepository.findOne.mockResolvedValueOnce(updatedTrip as Trip);

      const result = await service.update(
        mockUserId,
        mockTripId,
        updateTripDto,
      );

      expect(result).toBeDefined();
      expect(tripRepository.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a trip successfully', async () => {
      const tripToDelete = { ...mockTrip, itineraries: [] };
      tripRepository.findOne.mockResolvedValue(tripToDelete as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);
      tripRepository.remove.mockResolvedValue(tripToDelete as Trip);

      await service.remove(mockUserId, mockTripId);

      expect(tripRepository.remove).toHaveBeenCalledWith(tripToDelete);
    });

    it('should throw NotFoundException when trip not found', async () => {
      tripRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(mockUserId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce user isolation - different user cannot delete trip', async () => {
      tripRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('different-user-id', mockTripId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTripStatus', () => {
    it('should update upcoming trips to ongoing', async () => {
      const queryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      await service.updateTripStatus();

      expect(queryBuilder.set).toHaveBeenCalledWith({
        status: TripStatus.ONGOING,
      });
      expect(queryBuilder.where).toHaveBeenCalledWith('status = :status', {
        status: TripStatus.UPCOMING,
      });
    });

    it('should update ongoing trips to completed', async () => {
      const queryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      tripRepository.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      await service.updateTripStatus();

      expect(queryBuilder.set).toHaveBeenNthCalledWith(2, {
        status: TripStatus.COMPLETED,
      });
      expect(queryBuilder.where).toHaveBeenNthCalledWith(
        2,
        'status = :status',
        {
          status: TripStatus.ONGOING,
        },
      );
    });
  });

  describe('getUpcomingTrips', () => {
    it('should return all upcoming trips for user (including collaborator trips)', async () => {
      const upcomingTrips = [
        { ...mockTrip, status: TripStatus.UPCOMING },
        { ...mockTrip, id: 'trip-457', status: TripStatus.UPCOMING },
      ];

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(upcomingTrips),
      };
      tripRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getUpcomingTrips(mockUserId);

      expect(tripRepository.createQueryBuilder).toHaveBeenCalledWith('trip');
      expect(result).toHaveLength(2);
    });
  });

  describe('getOngoingTrips', () => {
    it('should return all ongoing trips for user (including collaborator trips)', async () => {
      const ongoingTrips = [{ ...mockTrip, status: TripStatus.ONGOING }];

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(ongoingTrips),
      };
      tripRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getOngoingTrips(mockUserId);

      expect(tripRepository.createQueryBuilder).toHaveBeenCalledWith('trip');
      expect(result).toHaveLength(1);
    });
  });

  describe('getCompletedTrips', () => {
    it('should return all completed trips for user (including collaborator trips)', async () => {
      const completedTrips = [{ ...mockTrip, status: TripStatus.COMPLETED }];

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(completedTrips),
      };
      tripRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getCompletedTrips(mockUserId);

      expect(tripRepository.createQueryBuilder).toHaveBeenCalledWith('trip');
      expect(result).toHaveLength(1);
    });
  });

  describe('updateItinerary', () => {
    it('should update itinerary successfully', async () => {
      const updateDto = { notes: 'Updated notes' };
      const existingItinerary = { ...mockItinerary };
      const updatedItinerary = { ...existingItinerary, ...updateDto };

      tripRepository.findOne.mockResolvedValue({
        ...mockTrip,
        itineraries: [],
      } as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);
      itineraryRepository.findOne.mockResolvedValue(
        existingItinerary as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue(updatedItinerary as Itinerary);

      const result = await service.updateItinerary(
        mockUserId,
        mockTripId,
        mockItineraryId,
        updateDto,
      );

      expect(itineraryRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when itinerary not found', async () => {
      tripRepository.findOne.mockResolvedValue({
        ...mockTrip,
        itineraries: [],
      } as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);
      itineraryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateItinerary(mockUserId, mockTripId, 'non-existent-id', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating completed trip itinerary', async () => {
      const completedTrip = {
        ...mockTrip,
        status: TripStatus.COMPLETED,
        itineraries: [],
      };
      tripRepository.findOne.mockResolvedValue(completedTrip as Trip);
      tripStatusScheduler.validateAndUpdateTripStatus.mockResolvedValue(false);

      await expect(
        service.updateItinerary(mockUserId, mockTripId, mockItineraryId, {
          notes: 'test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid date range gracefully', async () => {
      const invalidDto: CreateTripDto = {
        destination: 'Paris',
        startDate: '2024-06-05',
        endDate: '2024-06-01', // End before start
      };

      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(mockTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      aiService.generateAllItineraries.mockResolvedValue([]);
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...mockTrip,
        itineraries: [],
      } as Trip);

      await service.create(mockUserId, invalidDto);

      // Service should still create trip, but with 0 or negative days
      expect(tripRepository.save).toHaveBeenCalled();
    });

    it('should handle missing required fields in createDto', async () => {
      const minimalDto: CreateTripDto = {
        destination: 'Paris',
        startDate: '2024-06-01',
        endDate: '2024-06-05',
      };

      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(mockTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      timezoneService.getTimezoneInfo.mockResolvedValue(mockTimezoneInfo);
      aiService.generateAllItineraries.mockResolvedValue(mockAIItineraries);
      weatherService.getWeatherForDateRange.mockResolvedValue(mockWeatherMap);
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...mockTrip,
        itineraries: [],
      } as Trip);

      const result = await service.create(mockUserId, minimalDto);

      expect(result).toBeDefined();
      expect(tripRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          numberOfTravelers: 1,
        }),
      );
    });

    it('should handle null weather data gracefully', async () => {
      const savedTrip = { ...mockTrip };
      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(savedTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      timezoneService.getTimezoneInfo.mockResolvedValue(mockTimezoneInfo);
      aiService.generateAllItineraries.mockResolvedValue(mockAIItineraries);
      weatherService.getWeatherForDateRange.mockResolvedValue(new Map());
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...savedTrip,
        itineraries: [],
      } as Trip);

      const result = await service.create(mockUserId, {
        destination: 'Paris',
        startDate: '2024-06-01',
        endDate: '2024-06-05',
      });

      expect(result).toBeDefined();
    });

    it('should handle null timezone data gracefully', async () => {
      const savedTrip = { ...mockTrip };
      tripRepository.create.mockReturnValue(mockTrip as Trip);
      tripRepository.save.mockResolvedValue(savedTrip as Trip);
      timezoneService.getLocationInfo.mockResolvedValue(mockLocationInfo);
      timezoneService.getTimezoneInfo.mockResolvedValue(null);
      aiService.generateAllItineraries.mockResolvedValue(mockAIItineraries);
      weatherService.getWeatherForDateRange.mockResolvedValue(mockWeatherMap);
      itineraryRepository.create.mockImplementation(
        (data) => data as Itinerary,
      );
      itineraryRepository.save.mockResolvedValue([] as any);
      tripRepository.findOne.mockResolvedValue({
        ...savedTrip,
        itineraries: [],
      } as Trip);

      const result = await service.create(mockUserId, {
        destination: 'Paris',
        startDate: '2024-06-01',
        endDate: '2024-06-05',
      });

      expect(result).toBeDefined();
    });
  });
});
