import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { AffiliateService } from './affiliate.service';
import { AffiliateClick } from './entities/affiliate-click.entity';
import { TrackAffiliateClickDto } from './dto/track-affiliate-click.dto';
import { Request } from 'express';

describe('AffiliateService', () => {
  let service: AffiliateService;
  let repository: jest.Mocked<Repository<AffiliateClick>>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        {
          provide: getRepositoryToken(AffiliateClick),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
    repository = module.get(getRepositoryToken(AffiliateClick));

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('trackClick', () => {
    const mockDto: TrackAffiliateClickDto = {
      provider: 'booking',
      destination: 'Tokyo',
      checkIn: '2026-03-01',
      checkOut: '2026-03-05',
      travelers: 2,
      trackingId: 'trip_123',
      affiliateUrl: 'https://booking.com/affiliate?id=123',
      referrer: 'https://myapp.com/trips',
      tripId: 'trip-uuid-123',
      metadata: { campaign: 'spring-sale' },
    };

    const mockRequest = {
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '192.168.1.100, 10.0.0.1',
      },
      connection: { remoteAddress: '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    it('should track click successfully with all data', async () => {
      const mockClick = {
        id: 'click-uuid-1',
        provider: 'booking',
        destination: 'Tokyo',
        checkIn: new Date('2026-03-01'),
        checkOut: new Date('2026-03-05'),
        travelers: 2,
        trackingId: 'trip_123',
        affiliateUrl: 'https://booking.com/affiliate?id=123',
        referrer: 'https://myapp.com/trips',
        tripId: 'trip-uuid-123',
        userId: 'user-uuid-1',
        metadata: { campaign: 'spring-sale' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      const result = await service.trackClick(mockDto, 'user-uuid-1', mockRequest);

      expect(repository.create).toHaveBeenCalledWith({
        provider: 'booking',
        destination: 'Tokyo',
        checkIn: new Date('2026-03-01'),
        checkOut: new Date('2026-03-05'),
        travelers: 2,
        trackingId: 'trip_123',
        affiliateUrl: 'https://booking.com/affiliate?id=123',
        referrer: 'https://myapp.com/trips',
        tripId: 'trip-uuid-123',
        userId: 'user-uuid-1',
        metadata: { campaign: 'spring-sale' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      });

      expect(repository.save).toHaveBeenCalledWith(mockClick);
      expect(result).toEqual(mockClick);
    });

    it('should track click without optional fields', async () => {
      const minimalDto: TrackAffiliateClickDto = {
        provider: 'expedia',
      };

      const mockClick = {
        id: 'click-uuid-2',
        provider: 'expedia',
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      const result = await service.trackClick(minimalDto);

      expect(repository.create).toHaveBeenCalledWith({
        provider: 'expedia',
        destination: undefined,
        checkIn: undefined,
        checkOut: undefined,
        travelers: undefined,
        trackingId: undefined,
        affiliateUrl: undefined,
        referrer: undefined,
        tripId: undefined,
        userId: undefined,
        metadata: undefined,
        ipAddress: undefined,
        userAgent: undefined,
      });

      expect(result).toEqual(mockClick);
    });

    it('should extract IP address from x-forwarded-for header', async () => {
      const mockClick = { id: 'click-uuid-3', provider: 'booking' };
      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      await service.trackClick(mockDto, undefined, mockRequest);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.100',
        }),
      );
    });

    it('should extract IP address from x-real-ip header when x-forwarded-for is not present', async () => {
      const requestWithRealIp = {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-real-ip': '203.0.113.1',
        },
        connection: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      const mockClick = { id: 'click-uuid-4', provider: 'booking' };
      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      await service.trackClick(mockDto, undefined, requestWithRealIp);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.1',
        }),
      );
    });

    it('should extract IP address from connection.remoteAddress as fallback', async () => {
      const requestWithConnection = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        connection: { remoteAddress: '192.168.1.200' },
      } as unknown as Request;

      const mockClick = { id: 'click-uuid-5', provider: 'booking' };
      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      await service.trackClick(mockDto, undefined, requestWithConnection);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.200',
        }),
      );
    });

    it('should capture user agent from request headers', async () => {
      const mockClick = { id: 'click-uuid-6', provider: 'booking' };
      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      await service.trackClick(mockDto, undefined, mockRequest);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0',
        }),
      );
    });

    it('should store metadata correctly', async () => {
      const dtoWithMetadata: TrackAffiliateClickDto = {
        provider: 'airbnb',
        metadata: {
          campaign: 'summer-2026',
          source: 'email',
          customField: 'value',
        },
      };

      const mockClick = {
        id: 'click-uuid-7',
        provider: 'airbnb',
        metadata: dtoWithMetadata.metadata,
      };

      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      await service.trackClick(dtoWithMetadata);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            campaign: 'summer-2026',
            source: 'email',
            customField: 'value',
          },
        }),
      );
    });

    it('should handle errors and log them', async () => {
      const error = new Error('Database connection failed');
      mockRepository.create.mockReturnValue({} as any);
      mockRepository.save.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.trackClick(mockDto)).rejects.toThrow('Database connection failed');
      expect(loggerSpy).toHaveBeenCalledWith('Failed to track affiliate click: Database connection failed');
    });

    it('should log successful tracking', async () => {
      const mockClick = {
        id: 'click-uuid-8',
        provider: 'booking',
        destination: 'Tokyo',
      };

      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.trackClick(mockDto);

      expect(loggerSpy).toHaveBeenCalledWith('Tracked affiliate click: booking - Tokyo');
    });

    it('should log N/A when destination is not provided', async () => {
      const dtoWithoutDestination: TrackAffiliateClickDto = {
        provider: 'expedia',
      };

      const mockClick = {
        id: 'click-uuid-9',
        provider: 'expedia',
      };

      mockRepository.create.mockReturnValue(mockClick as any);
      mockRepository.save.mockResolvedValue(mockClick as any);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.trackClick(dtoWithoutDestination);

      expect(loggerSpy).toHaveBeenCalledWith('Tracked affiliate click: expedia - N/A');
    });
  });

  describe('updateConversion', () => {
    const clickId = 'click-uuid-1';
    const mockClick: Partial<AffiliateClick> = {
      id: clickId,
      provider: 'booking',
      destination: 'Tokyo',
      converted: false,
      createdAt: new Date(),
    };

    it('should update conversion successfully with value and commission', async () => {
      const conversionValue = 500;
      const commission = 50;

      mockRepository.findOne.mockResolvedValue(mockClick as AffiliateClick);

      const updatedClick = {
        ...mockClick,
        converted: true,
        convertedAt: expect.any(Date),
        conversionValue,
        commission,
      };

      mockRepository.save.mockResolvedValue(updatedClick as AffiliateClick);

      const result = await service.updateConversion(clickId, conversionValue, commission);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: clickId } });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          converted: true,
          convertedAt: expect.any(Date),
          conversionValue,
          commission,
        }),
      );
      expect(result.converted).toBe(true);
      expect(result.conversionValue).toBe(conversionValue);
      expect(result.commission).toBe(commission);
    });

    it('should update conversion without value and commission', async () => {
      mockRepository.findOne.mockResolvedValue(mockClick as AffiliateClick);

      const updatedClick = {
        ...mockClick,
        converted: true,
        convertedAt: expect.any(Date),
        conversionValue: undefined,
        commission: undefined,
      };

      mockRepository.save.mockResolvedValue(updatedClick as AffiliateClick);

      const result = await service.updateConversion(clickId);

      expect(result.converted).toBe(true);
      expect(result.convertedAt).toBeDefined();
      expect(result.conversionValue).toBeUndefined();
      expect(result.commission).toBeUndefined();
    });

    it('should throw error when click is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateConversion('non-existent-id')).rejects.toThrow(
        'Affiliate click not found',
      );

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should set convertedAt to current date', async () => {
      mockRepository.findOne.mockResolvedValue(mockClick as AffiliateClick);

      const beforeUpdate = new Date();
      mockRepository.save.mockImplementation(async (click: AffiliateClick) => {
        return { ...click, convertedAt: new Date() } as AffiliateClick;
      });

      const result = await service.updateConversion(clickId, 100, 10);

      expect(result.convertedAt).toBeDefined();
      expect(result.convertedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('getProviderStats', () => {
    it('should return statistics by provider with date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const mockClicks: Partial<AffiliateClick>[] = [
        {
          id: '1',
          provider: 'booking',
          converted: true,
          conversionValue: 500,
          commission: 50,
          createdAt: new Date('2026-01-15'),
        },
        {
          id: '2',
          provider: 'booking',
          converted: false,
          createdAt: new Date('2026-01-16'),
        },
        {
          id: '3',
          provider: 'booking',
          converted: true,
          conversionValue: 300,
          commission: 30,
          createdAt: new Date('2026-01-17'),
        },
        {
          id: '4',
          provider: 'expedia',
          converted: true,
          conversionValue: 400,
          commission: 40,
          createdAt: new Date('2026-01-18'),
        },
        {
          id: '5',
          provider: 'expedia',
          converted: false,
          createdAt: new Date('2026-01-19'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getProviderStats(startDate, endDate);

      expect(repository.find).toHaveBeenCalledWith({
        where: { createdAt: Between(startDate, endDate) },
      });

      expect(stats).toHaveLength(2);

      // Booking stats (3 clicks)
      const bookingStats = stats.find(s => s.provider === 'booking');
      expect(bookingStats).toBeDefined();
      expect(bookingStats!.totalClicks).toBe(3);
      expect(bookingStats!.conversions).toBe(2);
      expect(bookingStats!.conversionRate).toBeCloseTo(66.67, 1);
      expect(bookingStats!.totalRevenue).toBe(800);
      expect(bookingStats!.totalCommission).toBe(80);
      expect(bookingStats!.averageCommission).toBe(40);

      // Expedia stats (2 clicks)
      const expediaStats = stats.find(s => s.provider === 'expedia');
      expect(expediaStats).toBeDefined();
      expect(expediaStats!.totalClicks).toBe(2);
      expect(expediaStats!.conversions).toBe(1);
      expect(expediaStats!.conversionRate).toBe(50);
      expect(expediaStats!.totalRevenue).toBe(400);
      expect(expediaStats!.totalCommission).toBe(40);
      expect(expediaStats!.averageCommission).toBe(40);

      // Should be sorted by totalClicks descending
      expect(stats[0].provider).toBe('booking');
      expect(stats[1].provider).toBe('expedia');
    });

    it('should return statistics with only startDate', async () => {
      const startDate = new Date('2026-01-01');

      mockRepository.find.mockResolvedValue([]);

      await service.getProviderStats(startDate);

      expect(repository.find).toHaveBeenCalledWith({
        where: { createdAt: MoreThan(startDate) },
      });
    });

    it('should return statistics for all time when no dates provided', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.getProviderStats();

      expect(repository.find).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should handle zero conversions correctly', async () => {
      const mockClicks: Partial<AffiliateClick>[] = [
        { id: '1', provider: 'airbnb', converted: false, createdAt: new Date() },
        { id: '2', provider: 'airbnb', converted: false, createdAt: new Date() },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getProviderStats();

      expect(stats[0].conversions).toBe(0);
      expect(stats[0].conversionRate).toBe(0);
      expect(stats[0].totalRevenue).toBe(0);
      expect(stats[0].totalCommission).toBe(0);
      expect(stats[0].averageCommission).toBe(0);
    });

    it('should calculate correct aggregations with missing values', async () => {
      const mockClicks: Partial<AffiliateClick>[] = [
        {
          id: '1',
          provider: 'viator',
          converted: true,
          conversionValue: 200,
          commission: undefined,
          createdAt: new Date(),
        },
        {
          id: '2',
          provider: 'viator',
          converted: true,
          conversionValue: undefined,
          commission: 30,
          createdAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getProviderStats();

      expect(stats[0].totalRevenue).toBe(200);
      expect(stats[0].totalCommission).toBe(30);
      expect(stats[0].averageCommission).toBe(15);
    });
  });

  describe('getDailyStats', () => {
    it('should return daily statistics with provider filter', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-03');
      const provider = 'booking';

      const mockClicks: Partial<AffiliateClick>[] = [
        {
          id: '1',
          provider: 'booking',
          converted: true,
          conversionValue: 500,
          commission: 50,
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: '2',
          provider: 'booking',
          converted: false,
          createdAt: new Date('2026-01-01T15:00:00Z'),
        },
        {
          id: '3',
          provider: 'booking',
          converted: true,
          conversionValue: 300,
          commission: 30,
          createdAt: new Date('2026-01-02T12:00:00Z'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getDailyStats(startDate, endDate, provider);

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          createdAt: Between(startDate, endDate),
          provider: 'booking',
        },
        order: { createdAt: 'ASC' },
      });

      expect(stats).toHaveLength(2);

      // Day 1
      expect(stats[0].date).toBe('2026-01-01');
      expect(stats[0].clicks).toBe(2);
      expect(stats[0].conversions).toBe(1);
      expect(stats[0].revenue).toBe(500);
      expect(stats[0].commission).toBe(50);

      // Day 2
      expect(stats[1].date).toBe('2026-01-02');
      expect(stats[1].clicks).toBe(1);
      expect(stats[1].conversions).toBe(1);
      expect(stats[1].revenue).toBe(300);
      expect(stats[1].commission).toBe(30);
    });

    it('should return daily statistics without provider filter', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-02');

      const mockClicks: Partial<AffiliateClick>[] = [
        {
          id: '1',
          provider: 'booking',
          converted: true,
          conversionValue: 500,
          commission: 50,
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: '2',
          provider: 'expedia',
          converted: true,
          conversionValue: 400,
          commission: 40,
          createdAt: new Date('2026-01-01T15:00:00Z'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getDailyStats(startDate, endDate);

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          createdAt: Between(startDate, endDate),
        },
        order: { createdAt: 'ASC' },
      });

      expect(stats).toHaveLength(1);
      expect(stats[0].clicks).toBe(2);
      expect(stats[0].conversions).toBe(2);
      expect(stats[0].revenue).toBe(900);
      expect(stats[0].commission).toBe(90);
    });

    it('should sort results by date ascending', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-05');

      const mockClicks: Partial<AffiliateClick>[] = [
        {
          id: '1',
          provider: 'booking',
          converted: false,
          createdAt: new Date('2026-01-03T10:00:00Z'),
        },
        {
          id: '2',
          provider: 'booking',
          converted: false,
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: '3',
          provider: 'booking',
          converted: false,
          createdAt: new Date('2026-01-02T10:00:00Z'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getDailyStats(startDate, endDate);

      expect(stats[0].date).toBe('2026-01-01');
      expect(stats[1].date).toBe('2026-01-02');
      expect(stats[2].date).toBe('2026-01-03');
    });

    it('should handle days with no conversions', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-02');

      const mockClicks: Partial<AffiliateClick>[] = [
        {
          id: '1',
          provider: 'booking',
          converted: false,
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: '2',
          provider: 'booking',
          converted: false,
          createdAt: new Date('2026-01-01T15:00:00Z'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getDailyStats(startDate, endDate);

      expect(stats[0].conversions).toBe(0);
      expect(stats[0].revenue).toBe(0);
      expect(stats[0].commission).toBe(0);
    });

    it('should calculate correct aggregations with partial data', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-02');

      const mockClicks: Partial<AffiliateClick>[] = [
        {
          id: '1',
          provider: 'booking',
          converted: true,
          conversionValue: 100,
          commission: undefined,
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: '2',
          provider: 'booking',
          converted: true,
          conversionValue: undefined,
          commission: 20,
          createdAt: new Date('2026-01-01T15:00:00Z'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getDailyStats(startDate, endDate);

      expect(stats[0].revenue).toBe(100);
      expect(stats[0].commission).toBe(20);
    });
  });

  describe('IP extraction (private method)', () => {
    it('should extract IP from x-forwarded-for header (first IP)', () => {
      const request = {
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1, 172.16.0.1',
        },
      } as unknown as Request;

      const dto: TrackAffiliateClickDto = { provider: 'booking' };
      mockRepository.create.mockImplementation((data) => data as any);
      mockRepository.save.mockResolvedValue({} as any);

      service.trackClick(dto, undefined, request);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.100',
        }),
      );
    });

    it('should extract IP from x-real-ip header', () => {
      const request = {
        headers: {
          'x-real-ip': '203.0.113.5',
        },
        connection: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      const dto: TrackAffiliateClickDto = { provider: 'booking' };
      mockRepository.create.mockImplementation((data) => data as any);
      mockRepository.save.mockResolvedValue({} as any);

      service.trackClick(dto, undefined, request);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.5',
        }),
      );
    });

    it('should extract IP from connection.remoteAddress', () => {
      const request = {
        headers: {},
        connection: { remoteAddress: '192.168.1.50' },
      } as unknown as Request;

      const dto: TrackAffiliateClickDto = { provider: 'booking' };
      mockRepository.create.mockImplementation((data) => data as any);
      mockRepository.save.mockResolvedValue({} as any);

      service.trackClick(dto, undefined, request);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.50',
        }),
      );
    });

    it('should extract IP from socket.remoteAddress as final fallback', () => {
      const request = {
        headers: {},
        connection: {},
        socket: { remoteAddress: '10.0.0.100' },
      } as unknown as Request;

      const dto: TrackAffiliateClickDto = { provider: 'booking' };
      mockRepository.create.mockImplementation((data) => data as any);
      mockRepository.save.mockResolvedValue({} as any);

      service.trackClick(dto, undefined, request);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '10.0.0.100',
        }),
      );
    });

    it('should return "unknown" when no IP source is available', () => {
      const request = {
        headers: {},
        connection: {},
        socket: {},
      } as unknown as Request;

      const dto: TrackAffiliateClickDto = { provider: 'booking' };
      mockRepository.create.mockImplementation((data) => data as any);
      mockRepository.save.mockResolvedValue({} as any);

      service.trackClick(dto, undefined, request);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: 'unknown',
        }),
      );
    });
  });

  describe('Error handling and logging', () => {
    it('should log errors when trackClick fails', async () => {
      const dto: TrackAffiliateClickDto = { provider: 'booking' };
      const error = new Error('Database error');

      mockRepository.create.mockReturnValue({} as any);
      mockRepository.save.mockRejectedValue(error);

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.trackClick(dto)).rejects.toThrow('Database error');
      expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to track affiliate click: Database error');
    });

    it('should handle null values in conversion updates gracefully', async () => {
      const click: Partial<AffiliateClick> = {
        id: 'click-1',
        provider: 'booking',
        converted: false,
      };

      mockRepository.findOne.mockResolvedValue(click as AffiliateClick);
      mockRepository.save.mockResolvedValue({
        ...click,
        converted: true,
        convertedAt: new Date(),
        conversionValue: null,
        commission: null,
      } as AffiliateClick);

      const result = await service.updateConversion('click-1', null as any, null as any);

      expect(result.converted).toBe(true);
      expect(result.conversionValue).toBeNull();
      expect(result.commission).toBeNull();
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle empty clicks array in getProviderStats', async () => {
      mockRepository.find.mockResolvedValue([]);

      const stats = await service.getProviderStats();

      expect(stats).toEqual([]);
    });

    it('should handle empty clicks array in getDailyStats', async () => {
      mockRepository.find.mockResolvedValue([]);

      const stats = await service.getDailyStats(new Date(), new Date());

      expect(stats).toEqual([]);
    });

    it('should handle large numbers in conversion values', async () => {
      const mockClicks: Partial<AffiliateClick>[] = [
        {
          id: '1',
          provider: 'booking',
          converted: true,
          conversionValue: 999999.99,
          commission: 99999.99,
          createdAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(mockClicks as AffiliateClick[]);

      const stats = await service.getProviderStats();

      expect(stats[0].totalRevenue).toBe(999999.99);
      expect(stats[0].totalCommission).toBe(99999.99);
    });

    it('should trim whitespace from x-forwarded-for IP addresses', () => {
      const request = {
        headers: {
          'x-forwarded-for': '  192.168.1.100  , 10.0.0.1  ',
        },
      } as unknown as Request;

      const dto: TrackAffiliateClickDto = { provider: 'booking' };
      mockRepository.create.mockImplementation((data) => data as any);
      mockRepository.save.mockResolvedValue({} as any);

      service.trackClick(dto, undefined, request);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.100',
        }),
      );
    });
  });
});
