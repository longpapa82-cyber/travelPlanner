import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { Announcement, AnnouncementType, AnnouncementPriority, AnnouncementDisplayType, AnnouncementTargetAudience } from './entities/announcement.entity';
import { AnnouncementRead } from './entities/announcement-read.entity';
import { User } from '../users/entities/user.entity';

const mockAnnouncementRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockReadRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockUserRepo = () => ({
  findOne: jest.fn(),
});

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let announcementRepo: ReturnType<typeof mockAnnouncementRepo>;
  let readRepo: ReturnType<typeof mockReadRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementService,
        { provide: getRepositoryToken(Announcement), useFactory: mockAnnouncementRepo },
        { provide: getRepositoryToken(AnnouncementRead), useFactory: mockReadRepo },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
      ],
    }).compile();

    service = module.get<AnnouncementService>(AnnouncementService);
    announcementRepo = module.get(getRepositoryToken(Announcement));
    readRepo = module.get(getRepositoryToken(AnnouncementRead));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an announcement', async () => {
      const dto = {
        type: AnnouncementType.SYSTEM,
        title: { en: 'Test', ko: '테스트' },
        content: { en: 'Test content', ko: '테스트 내용' },
        startDate: '2026-03-01T00:00:00Z',
      };
      const created = { id: 'uuid-1', ...dto, startDate: new Date(dto.startDate) };
      announcementRepo.create.mockReturnValue(created);
      announcementRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);
      expect(result).toEqual(created);
      expect(announcementRepo.create).toHaveBeenCalled();
      expect(announcementRepo.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an announcement', async () => {
      const announcement = { id: 'uuid-1', title: { en: 'Test' } };
      announcementRepo.findOne.mockResolvedValue(announcement);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(announcement);
    });

    it('should throw NotFoundException if not found', async () => {
      announcementRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated announcements', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      announcementRepo.findAndCount.mockResolvedValue([items, 2]);

      const result = await service.findAll(1, 10);
      expect(result).toEqual({
        items,
        total: 2,
        page: 1,
        totalPages: 1,
      });
    });
  });

  describe('publish/unpublish', () => {
    it('should publish an announcement', async () => {
      const announcement = { id: 'uuid-1', isPublished: false };
      announcementRepo.findOne.mockResolvedValue(announcement);
      announcementRepo.save.mockResolvedValue({ ...announcement, isPublished: true });

      const result = await service.publish('uuid-1');
      expect(result.isPublished).toBe(true);
    });

    it('should unpublish an announcement', async () => {
      const announcement = { id: 'uuid-1', isPublished: true };
      announcementRepo.findOne.mockResolvedValue(announcement);
      announcementRepo.save.mockResolvedValue({ ...announcement, isPublished: false });

      const result = await service.unpublish('uuid-1');
      expect(result.isPublished).toBe(false);
    });
  });

  describe('markAsRead', () => {
    const activeAnnouncement = {
      id: 'uuid-1',
      isActive: true,
      isPublished: true,
      startDate: new Date('2020-01-01'),
      endDate: null,
    };

    it('should mark announcement as read', async () => {
      announcementRepo.findOne.mockResolvedValue(activeAnnouncement);
      readRepo.findOne.mockResolvedValue(null);
      readRepo.create.mockReturnValue({ userId: 'user-1', announcementId: 'uuid-1' });
      readRepo.save.mockResolvedValue({});

      await service.markAsRead('user-1', 'uuid-1');
      expect(readRepo.save).toHaveBeenCalled();
    });

    it('should skip if already read', async () => {
      announcementRepo.findOne.mockResolvedValue(activeAnnouncement);
      readRepo.findOne.mockResolvedValue({ id: 'read-1' });

      await service.markAsRead('user-1', 'uuid-1');
      expect(readRepo.save).not.toHaveBeenCalled();
    });

    it('should throw if announcement is not active', async () => {
      announcementRepo.findOne.mockResolvedValue(null);
      await expect(service.markAsRead('user-1', 'uuid-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('dismiss', () => {
    const activeAnnouncement = {
      id: 'uuid-1',
      isActive: true,
      isPublished: true,
      startDate: new Date('2020-01-01'),
      endDate: null,
    };

    it('should dismiss announcement', async () => {
      announcementRepo.findOne.mockResolvedValue(activeAnnouncement);
      readRepo.findOne.mockResolvedValue(null);
      readRepo.create.mockReturnValue({
        userId: 'user-1',
        announcementId: 'uuid-1',
        dismissedAt: expect.any(Date),
      });
      readRepo.save.mockResolvedValue({});

      await service.dismiss('user-1', 'uuid-1');
      expect(readRepo.save).toHaveBeenCalled();
    });

    it('should update existing read record with dismissedAt', async () => {
      const existing = { id: 'read-1', dismissedAt: null };
      announcementRepo.findOne.mockResolvedValue(activeAnnouncement);
      readRepo.findOne.mockResolvedValue(existing);
      readRepo.save.mockResolvedValue({});

      await service.dismiss('user-1', 'uuid-1');
      expect(existing.dismissedAt).toBeDefined();
      expect(readRepo.save).toHaveBeenCalledWith(existing);
    });

    it('should throw if announcement is not active', async () => {
      announcementRepo.findOne.mockResolvedValue(null);
      await expect(service.dismiss('user-1', 'uuid-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete announcement', async () => {
      announcementRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.remove('uuid-1')).resolves.not.toThrow();
    });

    it('should throw NotFoundException if not found', async () => {
      announcementRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
