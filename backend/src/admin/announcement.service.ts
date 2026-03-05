import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import {
  Announcement,
  AnnouncementTargetAudience,
} from './entities/announcement.entity';
import { AnnouncementRead } from './entities/announcement-read.entity';
import { User } from '../users/entities/user.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(AnnouncementRead)
    private readonly readRepo: Repository<AnnouncementRead>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private async getUserTier(userId: string): Promise<'free' | 'premium'> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'subscriptionTier'],
    });
    return (user?.subscriptionTier as 'free' | 'premium') || 'free';
  }

  // ─── Admin CRUD ──────────────────────────────

  async create(dto: CreateAnnouncementDto): Promise<Announcement> {
    const announcement = this.announcementRepo.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });
    return this.announcementRepo.save(announcement);
  }

  async findAll(page = 1, limit = 20) {
    const [items, total] = await this.announcementRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Announcement> {
    const announcement = await this.announcementRepo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto): Promise<Announcement> {
    const announcement = await this.findOne(id);
    Object.assign(announcement, {
      ...dto,
      startDate: dto.startDate
        ? new Date(dto.startDate)
        : announcement.startDate,
      endDate:
        dto.endDate !== undefined
          ? dto.endDate
            ? new Date(dto.endDate)
            : null
          : announcement.endDate,
    });
    return this.announcementRepo.save(announcement);
  }

  async remove(id: string): Promise<void> {
    const result = await this.announcementRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Announcement not found');
  }

  async publish(id: string): Promise<Announcement> {
    const announcement = await this.findOne(id);
    announcement.isPublished = true;
    return this.announcementRepo.save(announcement);
  }

  async unpublish(id: string): Promise<Announcement> {
    const announcement = await this.findOne(id);
    announcement.isPublished = false;
    return this.announcementRepo.save(announcement);
  }

  // ─── Public (User-facing) ─────────────────────

  async getActiveForUser(userId: string, lang = 'en') {
    const now = new Date();
    const userTier = await this.getUserTier(userId);

    const qb = this.announcementRepo
      .createQueryBuilder('a')
      .where('a.isActive = true')
      .andWhere('a.isPublished = true')
      .andWhere('a.startDate <= :now', { now })
      .andWhere('(a.endDate IS NULL OR a.endDate > :now)', { now });

    // Filter by audience
    if (userTier === 'premium') {
      qb.andWhere('a.targetAudience IN (:...audiences)', {
        audiences: [
          AnnouncementTargetAudience.ALL,
          AnnouncementTargetAudience.PREMIUM,
        ],
      });
    } else {
      qb.andWhere('a.targetAudience IN (:...audiences)', {
        audiences: [
          AnnouncementTargetAudience.ALL,
          AnnouncementTargetAudience.FREE,
        ],
      });
    }

    qb.orderBy('a.priority', 'ASC') // critical first
      .addOrderBy('a.createdAt', 'DESC')
      .take(50);

    const announcements = await qb.getMany();

    // Get read/dismissed status for this user
    const readRecords = await this.readRepo.find({
      where: { userId },
      select: ['announcementId', 'readAt', 'dismissedAt'],
    });
    const readMap = new Map(readRecords.map((r) => [r.announcementId, r]));

    return announcements.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title[lang] || a.title['en'] || Object.values(a.title)[0] || '',
      content:
        a.content[lang] || a.content['en'] || Object.values(a.content)[0] || '',
      priority: a.priority,
      displayType: a.displayType,
      imageUrl: a.imageUrl,
      actionUrl: a.actionUrl,
      actionLabel: a.actionLabel
        ? a.actionLabel[lang] ||
          a.actionLabel['en'] ||
          Object.values(a.actionLabel)[0] ||
          null
        : null,
      startDate: a.startDate,
      endDate: a.endDate,
      isRead: !!readMap.get(a.id)?.readAt,
      isDismissed: !!readMap.get(a.id)?.dismissedAt,
      createdAt: a.createdAt,
    }));
  }

  async getOneForUser(userId: string, announcementId: string, lang = 'en') {
    const a = await this.findActiveAnnouncement(announcementId);

    const readRecord = await this.readRepo.findOne({
      where: { userId, announcementId },
      select: ['readAt', 'dismissedAt'],
    });

    return {
      id: a.id,
      type: a.type,
      title: a.title[lang] || a.title['en'] || Object.values(a.title)[0] || '',
      content:
        a.content[lang] || a.content['en'] || Object.values(a.content)[0] || '',
      priority: a.priority,
      displayType: a.displayType,
      imageUrl: a.imageUrl,
      actionUrl: a.actionUrl,
      actionLabel: a.actionLabel
        ? a.actionLabel[lang] ||
          a.actionLabel['en'] ||
          Object.values(a.actionLabel)[0] ||
          null
        : null,
      startDate: a.startDate,
      endDate: a.endDate,
      isRead: !!readRecord?.readAt,
      isDismissed: !!readRecord?.dismissedAt,
      createdAt: a.createdAt,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const now = new Date();
    const userTier = await this.getUserTier(userId);

    const qb = this.announcementRepo
      .createQueryBuilder('a')
      .where('a.isActive = true')
      .andWhere('a.isPublished = true')
      .andWhere('a.startDate <= :now', { now })
      .andWhere('(a.endDate IS NULL OR a.endDate > :now)', { now });

    if (userTier === 'premium') {
      qb.andWhere('a.targetAudience IN (:...audiences)', {
        audiences: [
          AnnouncementTargetAudience.ALL,
          AnnouncementTargetAudience.PREMIUM,
        ],
      });
    } else {
      qb.andWhere('a.targetAudience IN (:...audiences)', {
        audiences: [
          AnnouncementTargetAudience.ALL,
          AnnouncementTargetAudience.FREE,
        ],
      });
    }

    // Exclude read announcements
    qb.andWhere((qb2) => {
      const subQuery = qb2
        .subQuery()
        .select('ar.announcementId')
        .from(AnnouncementRead, 'ar')
        .where('ar.userId = :userId')
        .getQuery();
      return `a.id NOT IN ${subQuery}`;
    }).setParameter('userId', userId);

    return qb.getCount();
  }

  private async findActiveAnnouncement(id: string): Promise<Announcement> {
    const now = new Date();
    const announcement = await this.announcementRepo.findOne({
      where: {
        id,
        isActive: true,
        isPublished: true,
        startDate: LessThanOrEqual(now),
      },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    if (announcement.endDate && announcement.endDate <= now) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  async markAsRead(userId: string, announcementId: string): Promise<void> {
    await this.findActiveAnnouncement(announcementId);

    const existing = await this.readRepo.findOne({
      where: { userId, announcementId },
    });

    if (existing) {
      // Already read, skip
      return;
    }

    await this.readRepo.save(this.readRepo.create({ userId, announcementId }));
  }

  async dismiss(userId: string, announcementId: string): Promise<void> {
    await this.findActiveAnnouncement(announcementId);

    const existing = await this.readRepo.findOne({
      where: { userId, announcementId },
    });

    if (existing) {
      existing.dismissedAt = new Date();
      await this.readRepo.save(existing);
    } else {
      await this.readRepo.save(
        this.readRepo.create({
          userId,
          announcementId,
          dismissedAt: new Date(),
        }),
      );
    }
  }
}
