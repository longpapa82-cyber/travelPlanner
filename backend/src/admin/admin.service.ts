import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Trip } from '../trips/entities/trip.entity';
import { ErrorLog } from './entities/error-log.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
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

    // Platform breakdown
    const platformStatsRaw = await this.userRepository
      .createQueryBuilder('u')
      .select('u.lastPlatform', 'platform')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN u.lastLoginAt >= :today THEN 1 ELSE 0 END)`,
        'todayActive',
      )
      .addSelect(
        `SUM(CASE WHEN u.lastLoginAt >= :weekAgo THEN 1 ELSE 0 END)`,
        'weeklyActive',
      )
      .where('u.lastPlatform IS NOT NULL')
      .setParameters({ today, weekAgo })
      .groupBy('u.lastPlatform')
      .getRawMany();

    const platformStats: Record<string, { total: number; todayActive: number; weeklyActive: number }> = {
      web: { total: 0, todayActive: 0, weeklyActive: 0 },
      ios: { total: 0, todayActive: 0, weeklyActive: 0 },
      android: { total: 0, todayActive: 0, weeklyActive: 0 },
    };

    for (const row of platformStatsRaw) {
      if (row.platform && platformStats[row.platform]) {
        platformStats[row.platform] = {
          total: parseInt(row.total, 10),
          todayActive: parseInt(row.todayActive, 10),
          weeklyActive: parseInt(row.weeklyActive, 10),
        };
      }
    }

    // Daily active by platform (30 days)
    const dailyActiveByPlatform = await this.userRepository
      .createQueryBuilder('u')
      .select("TO_CHAR(u.lastLoginAt, 'YYYY-MM-DD')", 'date')
      .addSelect(
        `SUM(CASE WHEN u.lastPlatform = 'web' THEN 1 ELSE 0 END)`,
        'web',
      )
      .addSelect(
        `SUM(CASE WHEN u.lastPlatform = 'ios' THEN 1 ELSE 0 END)`,
        'ios',
      )
      .addSelect(
        `SUM(CASE WHEN u.lastPlatform = 'android' THEN 1 ELSE 0 END)`,
        'android',
      )
      .where('u.lastLoginAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy("TO_CHAR(u.lastLoginAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      totalUsers,
      todaySignups,
      todayActive,
      weeklyActive,
      dailySignups,
      providerStats,
      platformStats,
      dailyActiveByPlatform,
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
    platform?: 'web' | 'ios' | 'android';
    userAgent?: string;
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

    // Platform breakdown
    const platformBreakdownRaw = await this.errorLogRepository
      .createQueryBuilder('e')
      .select('e.platform', 'platform')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN e.severity = 'fatal' THEN 1 ELSE 0 END)`,
        'fatal',
      )
      .addSelect(
        `SUM(CASE WHEN e.severity = 'error' THEN 1 ELSE 0 END)`,
        'error',
      )
      .addSelect(
        `SUM(CASE WHEN e.severity = 'warning' THEN 1 ELSE 0 END)`,
        'warning',
      )
      .where('e.createdAt >= :weekAgo', { weekAgo })
      .groupBy('e.platform')
      .getRawMany();

    const platformBreakdown: Record<string, { total: number; fatal: number; error: number; warning: number }> = {
      web: { total: 0, fatal: 0, error: 0, warning: 0 },
      ios: { total: 0, fatal: 0, error: 0, warning: 0 },
      android: { total: 0, fatal: 0, error: 0, warning: 0 },
    };

    for (const row of platformBreakdownRaw) {
      const key = row.platform || 'web';
      if (platformBreakdown[key]) {
        platformBreakdown[key] = {
          total: parseInt(row.total, 10),
          fatal: parseInt(row.fatal, 10),
          error: parseInt(row.error, 10),
          warning: parseInt(row.warning, 10),
        };
      }
    }

    return {
      todayErrors,
      weeklyErrors,
      unresolvedErrors,
      affectedUsers: parseInt(affectedUsers?.count || '0', 10),
      topErrors,
      hourlyTrend,
      platformBreakdown,
    };
  }

  async getErrorLogs(
    page = 1,
    limit = 20,
    severity?: string,
    resolved?: boolean,
    platform?: string,
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

    if (platform) {
      qb.andWhere('e.platform = :platform', { platform });
    }

    const total = await qb.getCount();
    const logs = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getSubscriptionStats() {
    const now = new Date();

    // Active subscribers by platform and tier
    const subsRaw = await this.userRepository
      .createQueryBuilder('u')
      .select('u.subscriptionPlatform', 'platform')
      .addSelect('u.subscriptionTier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .where('u.subscriptionTier = :premium', { premium: 'premium' })
      .andWhere('(u.subscriptionExpiresAt IS NULL OR u.subscriptionExpiresAt > :now)', { now })
      .groupBy('u.subscriptionPlatform')
      .addGroupBy('u.subscriptionTier')
      .getRawMany();

    // Commission rates by platform
    const commissions: Record<string, number> = {
      web: 0.03,      // Stripe: 2.9% + 30c ≈ 3%
      ios: 0.15,      // Apple: 15% (small business)
      android: 0.15,  // Google: 15% (first $1M)
    };

    const premiumPrice = 3.99; // monthly price

    const byPlatform: Record<string, { active: number; revenue: number; mrr: number }> = {
      web: { active: 0, revenue: 0, mrr: 0 },
      ios: { active: 0, revenue: 0, mrr: 0 },
      android: { active: 0, revenue: 0, mrr: 0 },
    };

    let totalActive = 0;
    for (const row of subsRaw) {
      const plat = row.platform || 'web';
      const count = parseInt(row.count, 10);
      totalActive += count;
      if (byPlatform[plat]) {
        byPlatform[plat].active = count;
        const gross = count * premiumPrice;
        const net = gross * (1 - (commissions[plat] || 0));
        byPlatform[plat].revenue = Math.round(net * 100) / 100;
        byPlatform[plat].mrr = Math.round(net * 100) / 100;
      }
    }

    const totalRevenue = Object.values(byPlatform).reduce((sum, p) => sum + p.revenue, 0);

    return {
      total: {
        active: totalActive,
        revenue: Math.round(totalRevenue * 100) / 100,
        mrr: Math.round(totalRevenue * 100) / 100,
      },
      byPlatform,
      commissions,
    };
  }

  async resolveErrorLog(id: string) {
    const result = await this.errorLogRepository.update(id, { isResolved: true });
    if (result.affected === 0) {
      throw new NotFoundException(`Error log ${id} not found`);
    }
    return { success: true };
  }

  // ─── AI Metrics ──────────────────────────────

  async getAiMetrics() {
    const results = await this.tripRepository
      .createQueryBuilder('t')
      .select('t.aiStatus', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('t.aiStatus')
      .getRawMany<{ status: string; count: number }>();

    const counts: Record<string, number> = { none: 0, success: 0, failed: 0, skipped: 0 };
    for (const r of results) {
      counts[r.status] = r.count;
    }

    const aiAttempted = counts.success + counts.failed;
    const successRate = aiAttempted > 0
      ? Math.round((counts.success / aiAttempted) * 100)
      : 100;

    return {
      total: counts.none + counts.success + counts.failed + counts.skipped,
      success: counts.success,
      failed: counts.failed,
      skipped: counts.skipped,
      manual: counts.none,
      successRate,
    };
  }
}
