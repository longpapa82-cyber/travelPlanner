import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageService } from '../common/image.service';
import { TripStatus } from './entities/trip.entity';

// Helper to simulate JSON serialization (Date -> string, undefined fields dropped)
const jsonify = (obj: any) => JSON.parse(JSON.stringify(obj));

// Valid UUIDs for test data (ParseUUIDPipe requires valid UUIDs)
const MOCK_USER_ID = '00000000-0000-4000-a000-000000000001';
const MOCK_TRIP_ID = '00000000-0000-4000-a000-000000000010';
const MOCK_TRIP_ID_2 = '00000000-0000-4000-a000-000000000011';
const MOCK_TRIP_ID_3 = '00000000-0000-4000-a000-000000000012';
const MOCK_ITINERARY_ID = '00000000-0000-4000-a000-000000000020';
const MOCK_COLLAB_ID = '00000000-0000-4000-a000-000000000030';

describe('TripsController (Integration)', () => {
  let app: INestApplication;
  let tripsService: jest.Mocked<TripsService>;

  // Mock user data
  const mockUserId = MOCK_USER_ID;
  const mockUser = { userId: mockUserId, isEmailVerified: true };

  // Mock trip data
  const mockTrip = {
    id: MOCK_TRIP_ID,
    userId: mockUserId,
    destination: 'Paris, France',
    country: 'France',
    city: 'Paris',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-07'),
    description: 'Summer vacation in Paris',
    status: TripStatus.UPCOMING,
    numberOfTravelers: 2,
    preferences: {
      budget: 'medium',
      travelStyle: 'cultural',
      interests: ['museums', 'food'],
    },
    itineraries: [
      {
        id: MOCK_ITINERARY_ID,
        tripId: MOCK_TRIP_ID,
        date: new Date('2024-06-01'),
        dayNumber: 1,
        activities: [
          {
            time: '09:00',
            title: 'Visit Eiffel Tower',
            description: 'Morning visit to iconic landmark',
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
          condition: 'sunny',
          humidity: 60,
        },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTrips = [mockTrip];

  const mockTripsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    updateItinerary: jest.fn(),
    addActivity: jest.fn(),
    updateActivity: jest.fn(),
    deleteActivity: jest.fn(),
    reorderActivities: jest.fn(),
    getUpcomingTrips: jest.fn(),
    getOngoingTrips: jest.fn(),
    getCompletedTrips: jest.fn(),
    getUserStats: jest.fn(),
    duplicate: jest.fn(),
    generateShareToken: jest.fn(),
    disableSharing: jest.fn(),
    addCollaborator: jest.fn(),
    getCollaborators: jest.fn(),
    updateCollaboratorRole: jest.fn(),
    removeCollaborator: jest.fn(),
    leaveTrip: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TripsController],
      providers: [
        {
          provide: TripsService,
          useValue: mockTripsService,
        },
        {
          provide: ImageService,
          useValue: { processUpload: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn((context) => {
          const request = context.switchToHttp().getRequest();
          // Mock authenticated user
          request.user = mockUser;
          return true;
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();

    // Apply global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    tripsService = moduleRef.get(TripsService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /trips', () => {
    it('should create a new trip with valid data', async () => {
      const createTripDto = {
        destination: 'Tokyo, Japan',
        country: 'Japan',
        city: 'Tokyo',
        startDate: '2024-07-01',
        endDate: '2024-07-10',
        description: 'Summer trip to Tokyo',
        numberOfTravelers: 2,
        preferences: {
          budget: 'medium',
          travelStyle: 'cultural',
          interests: ['temples', 'food'],
        },
      };

      tripsService.create.mockResolvedValue(mockTrip as any);

      const response = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', 'Bearer mock-token')
        .send(createTripDto)
        .expect(201);

      expect(response.body).toEqual(jsonify(mockTrip));
      expect(tripsService.create).toHaveBeenCalledWith(
        mockUserId,
        createTripDto,
        expect.any(String),
      );
      expect(tripsService.create).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when destination is missing', async () => {
      const invalidDto = {
        startDate: '2024-07-01',
        endDate: '2024-07-10',
      };

      await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', 'Bearer mock-token')
        .send(invalidDto)
        .expect(400);

      expect(tripsService.create).not.toHaveBeenCalled();
    });

    it('should return 400 when startDate is invalid', async () => {
      const invalidDto = {
        destination: 'Tokyo, Japan',
        startDate: 'invalid-date',
        endDate: '2024-07-10',
      };

      await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', 'Bearer mock-token')
        .send(invalidDto)
        .expect(400);

      expect(tripsService.create).not.toHaveBeenCalled();
    });

    it('should return 400 when numberOfTravelers is less than 1', async () => {
      const invalidDto = {
        destination: 'Tokyo, Japan',
        startDate: '2024-07-01',
        endDate: '2024-07-10',
        numberOfTravelers: 0,
      };

      await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', 'Bearer mock-token')
        .send(invalidDto)
        .expect(400);

      expect(tripsService.create).not.toHaveBeenCalled();
    });

    it('should return 400 when destination exceeds max length', async () => {
      const invalidDto = {
        destination: 'A'.repeat(201), // MaxLength is 200
        startDate: '2024-07-01',
        endDate: '2024-07-10',
      };

      await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', 'Bearer mock-token')
        .send(invalidDto)
        .expect(400);

      expect(tripsService.create).not.toHaveBeenCalled();
    });

    it('should create trip with optional fields omitted', async () => {
      const minimalDto = {
        destination: 'Tokyo, Japan',
        startDate: '2024-07-01',
        endDate: '2024-07-10',
      };

      tripsService.create.mockResolvedValue(mockTrip as any);

      await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', 'Bearer mock-token')
        .send(minimalDto)
        .expect(201);

      expect(tripsService.create).toHaveBeenCalledWith(
        mockUserId,
        minimalDto,
        expect.any(String),
      );
    });

    it('should return 401/403 when not authenticated', async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [TripsController],
        providers: [
          {
            provide: TripsService,
            useValue: mockTripsService,
          },
          {
            provide: ImageService,
            useValue: { processUpload: jest.fn() },
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: jest.fn(() => false),
        })
        .compile();

      const testApp = moduleRef.createNestApplication();
      await testApp.init();

      const createTripDto = {
        destination: 'Tokyo, Japan',
        startDate: '2024-07-01',
        endDate: '2024-07-10',
      };

      await request(testApp.getHttpServer())
        .post('/trips')
        .send(createTripDto)
        .expect(403);

      expect(tripsService.create).not.toHaveBeenCalled();

      await testApp.close();
    });
  });

  describe('GET /trips', () => {
    it('should return all trips for authenticated user', async () => {
      tripsService.findAll.mockResolvedValue(mockTrips as any);

      const response = await request(app.getHttpServer())
        .get('/trips')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toEqual(jsonify(mockTrips));
      expect(tripsService.findAll).toHaveBeenCalledWith(mockUserId, {});
      expect(tripsService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should filter trips by status query parameter', async () => {
      tripsService.findAll.mockResolvedValue(mockTrips as any);

      await request(app.getHttpServer())
        .get('/trips?status=upcoming')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(tripsService.findAll).toHaveBeenCalledWith(mockUserId, {
        status: 'upcoming',
      });
    });

    it('should filter trips by search query parameter', async () => {
      tripsService.findAll.mockResolvedValue(mockTrips as any);

      await request(app.getHttpServer())
        .get('/trips?search=Paris')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(tripsService.findAll).toHaveBeenCalledWith(mockUserId, {
        search: 'Paris',
      });
    });

    it('should support sorting with sortBy and order parameters', async () => {
      tripsService.findAll.mockResolvedValue(mockTrips as any);

      await request(app.getHttpServer())
        .get('/trips?sortBy=destination&order=ASC')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(tripsService.findAll).toHaveBeenCalledWith(mockUserId, {
        sortBy: 'destination',
        order: 'ASC',
      });
    });

    it('should return empty array when user has no trips', async () => {
      tripsService.findAll.mockResolvedValue({
        trips: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const response = await request(app.getHttpServer())
        .get('/trips')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body.trips).toEqual([]);
      expect(tripsService.findAll).toHaveBeenCalledWith(mockUserId, {});
    });
  });

  describe('GET /trips/:id', () => {
    it('should return a specific trip by id', async () => {
      tripsService.findOne.mockResolvedValue(mockTrip as any);

      const response = await request(app.getHttpServer())
        .get(`/trips/${MOCK_TRIP_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toEqual(jsonify(mockTrip));
      expect(tripsService.findOne).toHaveBeenCalledWith(mockUserId, MOCK_TRIP_ID);
      expect(tripsService.findOne).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when trip id is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/trips/non-existent-id')
        .set('Authorization', 'Bearer mock-token')
        .expect(400);

      expect(tripsService.findOne).not.toHaveBeenCalled();
    });

    it('should return 404 when trip not found', async () => {
      tripsService.findOne.mockRejectedValue(
        new (require('@nestjs/common').NotFoundException)('Trip not found'),
      );

      await request(app.getHttpServer())
        .get(`/trips/${MOCK_TRIP_ID_2}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(404);

      expect(tripsService.findOne).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID_2,
      );
    });

    it("should return 403 when trying to access another user's trip", async () => {
      tripsService.findOne.mockRejectedValue(
        new (require('@nestjs/common').ForbiddenException)('Forbidden'),
      );

      await request(app.getHttpServer())
        .get(`/trips/${MOCK_TRIP_ID_3}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(403);

      expect(tripsService.findOne).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID_3,
      );
    });
  });

  describe('PATCH /trips/:id', () => {
    it('should update a trip with valid data', async () => {
      const updateTripDto = {
        destination: 'Updated Paris, France',
        description: 'Updated description',
      };

      const updatedTrip = { ...mockTrip, ...updateTripDto };
      tripsService.update.mockResolvedValue(updatedTrip as any);

      const response = await request(app.getHttpServer())
        .patch(`/trips/${MOCK_TRIP_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .send(updateTripDto)
        .expect(200);

      expect(response.body).toEqual(jsonify(updatedTrip));
      expect(tripsService.update).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID,
        updateTripDto,
      );
      expect(tripsService.update).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when update data is invalid', async () => {
      const invalidDto = {
        numberOfTravelers: 0, // Min is 1
      };

      await request(app.getHttpServer())
        .patch(`/trips/${MOCK_TRIP_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .send(invalidDto)
        .expect(400);

      expect(tripsService.update).not.toHaveBeenCalled();
    });

    it('should return 403 when trying to update completed trip', async () => {
      tripsService.update.mockRejectedValue(
        new (require('@nestjs/common').ForbiddenException)('Cannot modify completed trips'),
      );

      const updateDto = {
        destination: 'New destination',
      };

      await request(app.getHttpServer())
        .patch(`/trips/${MOCK_TRIP_ID_2}`)
        .set('Authorization', 'Bearer mock-token')
        .send(updateDto)
        .expect(403);

      expect(tripsService.update).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID_2,
        updateDto,
      );
    });

    it('should accept partial updates', async () => {
      const partialUpdate = {
        description: 'Only updating description',
      };

      tripsService.update.mockResolvedValue({
        ...mockTrip,
        ...partialUpdate,
      } as any);

      await request(app.getHttpServer())
        .patch(`/trips/${MOCK_TRIP_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .send(partialUpdate)
        .expect(200);

      expect(tripsService.update).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID,
        partialUpdate,
      );
    });
  });

  describe('DELETE /trips/:id', () => {
    it('should delete a trip and return 204', async () => {
      tripsService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/trips/${MOCK_TRIP_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(204);

      expect(tripsService.remove).toHaveBeenCalledWith(mockUserId, MOCK_TRIP_ID);
      expect(tripsService.remove).toHaveBeenCalledTimes(1);
    });

    it('should return 404 when trying to delete non-existent trip', async () => {
      tripsService.remove.mockRejectedValue(
        new (require('@nestjs/common').NotFoundException)('Trip not found'),
      );

      await request(app.getHttpServer())
        .delete(`/trips/${MOCK_TRIP_ID_2}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(404);

      expect(tripsService.remove).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID_2,
      );
    });
  });

  describe('GET /trips/upcoming', () => {
    it('should return upcoming trips', async () => {
      const upcomingTrips = [{ ...mockTrip, status: TripStatus.UPCOMING }];
      tripsService.getUpcomingTrips.mockResolvedValue(upcomingTrips as any);

      const response = await request(app.getHttpServer())
        .get('/trips/upcoming')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toEqual(jsonify(upcomingTrips));
      expect(tripsService.getUpcomingTrips).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('GET /trips/ongoing', () => {
    it('should return ongoing trips', async () => {
      const ongoingTrips = [{ ...mockTrip, status: TripStatus.ONGOING }];
      tripsService.getOngoingTrips.mockResolvedValue(ongoingTrips as any);

      const response = await request(app.getHttpServer())
        .get('/trips/ongoing')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toEqual(jsonify(ongoingTrips));
      expect(tripsService.getOngoingTrips).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('GET /trips/completed', () => {
    it('should return completed trips', async () => {
      const completedTrips = [{ ...mockTrip, status: TripStatus.COMPLETED }];
      tripsService.getCompletedTrips.mockResolvedValue(completedTrips as any);

      const response = await request(app.getHttpServer())
        .get('/trips/completed')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toEqual(jsonify(completedTrips));
      expect(tripsService.getCompletedTrips).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('POST /trips/:tripId/itineraries/:itineraryId/activities', () => {
    it('should add a new activity to itinerary', async () => {
      const addActivityDto = {
        time: '14:00',
        title: 'Louvre Museum',
        description: 'Visit world-famous museum',
        location: 'Louvre Museum',
        estimatedDuration: 180,
        estimatedCost: 15,
        type: 'sightseeing',
      };

      const updatedItinerary = {
        ...mockTrip.itineraries[0],
        activities: [...mockTrip.itineraries[0].activities, addActivityDto],
      };

      tripsService.addActivity.mockResolvedValue(updatedItinerary as any);

      const response = await request(app.getHttpServer())
        .post(`/trips/${MOCK_TRIP_ID}/itineraries/${MOCK_ITINERARY_ID}/activities`)
        .set('Authorization', 'Bearer mock-token')
        .send(addActivityDto)
        .expect(201);

      expect(response.body).toEqual(jsonify(updatedItinerary));
      expect(tripsService.addActivity).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID,
        MOCK_ITINERARY_ID,
        addActivityDto,
      );
    });

    it('should return 400 when activity data is invalid', async () => {
      const invalidDto = {
        title: 'Missing required time field',
      };

      await request(app.getHttpServer())
        .post(`/trips/${MOCK_TRIP_ID}/itineraries/${MOCK_ITINERARY_ID}/activities`)
        .set('Authorization', 'Bearer mock-token')
        .send(invalidDto)
        .expect(400);

      expect(tripsService.addActivity).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /trips/:tripId/itineraries/:itineraryId/activities/:index', () => {
    it('should update an activity', async () => {
      const updateActivityDto = {
        title: 'Updated activity title',
        completed: true,
      };

      const updatedItinerary = mockTrip.itineraries[0];
      tripsService.updateActivity.mockResolvedValue(updatedItinerary as any);

      const response = await request(app.getHttpServer())
        .patch(`/trips/${MOCK_TRIP_ID}/itineraries/${MOCK_ITINERARY_ID}/activities/0`)
        .set('Authorization', 'Bearer mock-token')
        .send(updateActivityDto)
        .expect(200);

      expect(response.body).toEqual(jsonify(updatedItinerary));
      expect(tripsService.updateActivity).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID,
        MOCK_ITINERARY_ID,
        0,
        updateActivityDto,
      );
    });

    it('should return 403 when trying to modify past activity in ongoing trip', async () => {
      tripsService.updateActivity.mockRejectedValue(
        new (require('@nestjs/common').ForbiddenException)('Cannot modify past activities'),
      );

      const updateDto = {
        title: 'Updated title',
      };

      await request(app.getHttpServer())
        .patch(`/trips/${MOCK_TRIP_ID}/itineraries/${MOCK_ITINERARY_ID}/activities/0`)
        .set('Authorization', 'Bearer mock-token')
        .send(updateDto)
        .expect(403);

      expect(tripsService.updateActivity).toHaveBeenCalled();
    });
  });

  describe('DELETE /trips/:tripId/itineraries/:itineraryId/activities/:index', () => {
    it('should delete an activity and return 200', async () => {
      const updatedItinerary = {
        ...mockTrip.itineraries[0],
        activities: [],
      };

      tripsService.deleteActivity.mockResolvedValue(updatedItinerary as any);

      const response = await request(app.getHttpServer())
        .delete(`/trips/${MOCK_TRIP_ID}/itineraries/${MOCK_ITINERARY_ID}/activities/0`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toEqual(jsonify(updatedItinerary));
      expect(tripsService.deleteActivity).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID,
        MOCK_ITINERARY_ID,
        0,
      );
    });

    it('should return 404 when activity index is invalid', async () => {
      tripsService.deleteActivity.mockRejectedValue(
        new (require('@nestjs/common').NotFoundException)('Activity not found at the specified index'),
      );

      await request(app.getHttpServer())
        .delete(`/trips/${MOCK_TRIP_ID}/itineraries/${MOCK_ITINERARY_ID}/activities/999`)
        .set('Authorization', 'Bearer mock-token')
        .expect(404);

      expect(tripsService.deleteActivity).toHaveBeenCalledWith(
        mockUserId,
        MOCK_TRIP_ID,
        MOCK_ITINERARY_ID,
        999,
      );
    });
  });

  describe('POST /trips/:id/share', () => {
    it('should generate share link for trip', async () => {
      const shareResponse = {
        shareToken: 'abc123token',
        shareUrl: '/share/abc123token',
      };

      tripsService.generateShareToken.mockResolvedValue(shareResponse);

      const response = await request(app.getHttpServer())
        .post(`/trips/${MOCK_TRIP_ID}/share`)
        .set('Authorization', 'Bearer mock-token')
        .send({ expiresInDays: 7 })
        .expect(201);

      expect(response.body).toEqual(jsonify(shareResponse));
      expect(tripsService.generateShareToken).toHaveBeenCalledWith(
        MOCK_TRIP_ID,
        mockUserId,
        7,
      );
    });

    it('should generate share link without expiration', async () => {
      const shareResponse = {
        shareToken: 'abc123token',
        shareUrl: '/share/abc123token',
      };

      tripsService.generateShareToken.mockResolvedValue(shareResponse);

      await request(app.getHttpServer())
        .post(`/trips/${MOCK_TRIP_ID}/share`)
        .set('Authorization', 'Bearer mock-token')
        .send({})
        .expect(201);

      expect(tripsService.generateShareToken).toHaveBeenCalledWith(
        MOCK_TRIP_ID,
        mockUserId,
        undefined,
      );
    });
  });

  describe('DELETE /trips/:id/share', () => {
    it('should disable sharing and return 204', async () => {
      tripsService.disableSharing.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/trips/${MOCK_TRIP_ID}/share`)
        .set('Authorization', 'Bearer mock-token')
        .expect(204);

      expect(tripsService.disableSharing).toHaveBeenCalledWith(
        MOCK_TRIP_ID,
        mockUserId,
      );
    });
  });

  describe('DELETE /trips/:id/leave', () => {
    it('should leave trip and return 204', async () => {
      tripsService.leaveTrip.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/trips/${MOCK_TRIP_ID}/leave`)
        .set('Authorization', 'Bearer mock-token')
        .expect(204);

      expect(tripsService.leaveTrip).toHaveBeenCalledWith(
        MOCK_TRIP_ID,
        mockUserId,
      );
    });
  });

  describe('Request User Decorator Integration', () => {
    it('should extract userId from request using @Request decorator', async () => {
      tripsService.findAll.mockResolvedValue(mockTrips as any);

      await request(app.getHttpServer())
        .get('/trips')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      // Verify that the service was called with userId from request.user.userId
      expect(tripsService.findAll).toHaveBeenCalledWith(mockUserId, {});
    });

    it('should pass user context to all service methods', async () => {
      tripsService.findOne.mockResolvedValue(mockTrip as any);

      await request(app.getHttpServer())
        .get(`/trips/${MOCK_TRIP_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      // First argument should always be userId from authenticated user
      expect(tripsService.findOne).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
      );
    });
  });

  describe('Response Format Validation', () => {
    it('should return correct trip structure', async () => {
      tripsService.findOne.mockResolvedValue(mockTrip as any);

      const response = await request(app.getHttpServer())
        .get(`/trips/${MOCK_TRIP_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('destination');
      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('itineraries');
      expect(Array.isArray(response.body.itineraries)).toBe(true);
    });

    it('should return application/json content type', async () => {
      tripsService.findAll.mockResolvedValue(mockTrips as any);

      const response = await request(app.getHttpServer())
        .get('/trips')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Guard Integration', () => {
    it('should require authentication for all endpoints', async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [TripsController],
        providers: [
          {
            provide: TripsService,
            useValue: mockTripsService,
          },
          {
            provide: ImageService,
            useValue: { processUpload: jest.fn() },
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: jest.fn(() => false),
        })
        .compile();

      const testApp = moduleRef.createNestApplication();
      await testApp.init();

      // Test multiple endpoints
      await request(testApp.getHttpServer()).get('/trips').expect(403);
      await request(testApp.getHttpServer()).get(`/trips/${MOCK_TRIP_ID}`).expect(403);
      await request(testApp.getHttpServer())
        .post('/trips')
        .send({})
        .expect(403);
      await request(testApp.getHttpServer())
        .patch(`/trips/${MOCK_TRIP_ID}`)
        .send({})
        .expect(403);
      await request(testApp.getHttpServer())
        .delete(`/trips/${MOCK_TRIP_ID}`)
        .expect(403);

      // No service methods should be called
      expect(tripsService.findAll).not.toHaveBeenCalled();
      expect(tripsService.findOne).not.toHaveBeenCalled();
      expect(tripsService.create).not.toHaveBeenCalled();
      expect(tripsService.update).not.toHaveBeenCalled();
      expect(tripsService.remove).not.toHaveBeenCalled();

      await testApp.close();
    });
  });
});
