import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ErrorLog } from './entities/error-log.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ErrorLog)
    private readonly errorLogRepository: Repository<ErrorLog>,
  ) {}

  // ─── User Management ───────────────────────────

  async getUserStats() {
    const totalUsers = await this.userRepository.count();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySignups = await this.userRepository
      .createQueryBuilder('u')
      .where('u.createdAt >= :today', { today })
      .getCount();

    const todayActive = await this.userRepository
      .createQueryBuilder('u')
      .where('u.lastLoginAt >= :today', { today })
      .getCount();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyActive = await this.userRepository
      .createQueryBuilder('u')
      .where('u.lastLoginAt >= :weekAgo', { weekAgo })
      .getCount();

    // Daily signups for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailySignups = await this.userRepository
      .createQueryBuilder('u')
      .select("TO_CHAR(u.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('u.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy("TO_CHAR(u.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    // Provider breakdown
    const providerStats = await this.userRepository
      .createQueryBuilder('u')
      .select('u.provider', 'provider')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.provider')
      .getRawMany();

    return {
      totalUsers,
      todaySignups,
      todayActive,
      weeklyActive,
      dailySignups,
      providerStats,
    };
  }

  async getUsers(page = 1, limit = 20, search?: string, provider?: string) {
    const qb = this.userRepository
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.email',
        'u.name',
        'u.provider',
        'u.profileImage',
        'u.isEmailVerified',
        'u.lastLoginAt',
        'u.createdAt',
      ])
      .orderBy('u.createdAt', 'DESC');

    if (search) {
      qb.andWhere('(u.name ILIKE :search OR u.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (provider) {
      qb.andWhere('u.provider = :provider', { provider });
    }

    const total = await qb.getCount();
    const users = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Error Logs ─────────────────────────────────

  async createErrorLog(data: {
    userId?: string;
    userEmail?: string;
    errorMessage: string;
    stackTrace?: string;
    screen?: string;
    severity?: 'error' | 'warning' | 'fatal';
    deviceOS?: string;
    appVersion?: string;
  }) {
    const log = this.errorLogRepository.create(data);
    return this.errorLogRepository.save(log);
  }

  async getErrorLogStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayErrors = await this.errorLogRepository
      .createQueryBuilder('e')
      .where('e.createdAt >= :today', { today })
      .getCount();

    const weeklyErrors = await this.errorLogRepository
      .createQueryBuilder('e')
      .where('e.createdAt >= :weekAgo', { weekAgo })
      .getCount();

    const unresolvedErrors = await this.errorLogRepository
      .createQueryBuilder('e')
      .where('e.isResolved = false')
      .getCount();

    const affectedUsers = await this.errorLogRepository
      .createQueryBuilder('e')
      .select('COUNT(DISTINCT e.userId)', 'count')
      .where('e.createdAt >= :weekAgo', { weekAgo })
      .getRawOne();

    // Top errors
    const topErrors = await this.errorLogRepository
      .createQueryBuilder('e')
      .select('e.errorMessage', 'message')
      .addSelect('e.screen', 'screen')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(e.createdAt)', 'lastOccurrence')
      .where('e.createdAt >= :weekAgo', { weekAgo })
      .groupBy('e.errorMessage')
      .addGroupBy('e.screen')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Hourly trend (last 24h)
    const dayAgo = new Date();
    dayAgo.setHours(dayAgo.getHours() - 24);

    const hourlyTrend = await this.errorLogRepository
      .createQueryBuilder('e')
      .select("TO_CHAR(e.createdAt, 'YYYY-MM-DD HH24')", 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :dayAgo', { dayAgo })
      .groupBy("TO_CHAR(e.createdAt, 'YYYY-MM-DD HH24')")
      .orderBy('hour', 'ASC')
      .getRawMany();

    return {
      todayErrors,
      weeklyErrors,
      unresolvedErrors,
      affectedUsers: parseInt(affectedUsers?.count || '0', 10),
      topErrors,
      hourlyTrend,
    };
  }

  async getErrorLogs(
    page = 1,
    limit = 20,
    severity?: string,
    resolved?: boolean,
  ) {
    const qb = this.errorLogRepository
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC');

    if (severity) {
      qb.andWhere('e.severity = :severity', { severity });
    }

    if (resolved !== undefined) {
      qb.andWhere('e.isResolved = :resolved', { resolved });
    }

    const total = await qb.getCount();
    const logs = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  }

  async resolveErrorLog(id: string) {
    await this.errorLogRepository.update(id, { isResolved: true });
    return { success: true };
  }
}
