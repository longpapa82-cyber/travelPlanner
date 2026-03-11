import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiUsage, ApiProvider, ApiFeature, ApiStatus } from './entities/api-usage.entity';

export interface ApiUsageSummary {
  today: { totalCost: number; totalCalls: number; byProvider: Record<string, { cost: number; calls: number }> };
  mtd: { totalCost: number; totalCalls: number; byProvider: Record<string, { cost: number; calls: number }> };
  prevMonth: { totalCost: number; totalCalls: number };
  forecast: number;
  errorRate: number;
}

export interface DailyUsage {
  date: string;
  totalCost: number;
  totalCalls: number;
  byProvider: Record<string, { cost: number; calls: number }>;
}

export interface MonthlyUsage {
  month: number;
  totalCost: number;
  totalCalls: number;
  byProvider: Record<string, { cost: number; calls: number }>;
}

@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name);

  constructor(
    @InjectRepository(ApiUsage)
    private readonly apiUsageRepo: Repository<ApiUsage>,
  ) {}

  /**
   * Log an API usage record (fire-and-forget safe).
   */
  async logApiUsage(data: {
    provider: ApiProvider;
    feature: ApiFeature;
    status?: ApiStatus;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    latencyMs?: number;
    errorCode?: string;
    userId?: string;
  }): Promise<void> {
    try {
      const record = this.apiUsageRepo.create();
      record.provider = data.provider;
      record.feature = data.feature;
      record.status = data.status || 'success';
      record.inputTokens = data.inputTokens ?? null as any;
      record.outputTokens = data.outputTokens ?? null as any;
      record.costUsd = data.costUsd ?? 0;
      record.latencyMs = data.latencyMs ?? 0;
      record.errorCode = data.errorCode ?? null as any;
      record.userId = data.userId ?? null as any;
      await this.apiUsageRepo.save(record);
    } catch (error) {
      this.logger.warn(
        `Failed to log API usage: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getApiUsageSummary(): Promise<ApiUsageSummary> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Today stats
    const todayRows = await this.apiUsageRepo
      .createQueryBuilder('u')
      .select('u.provider', 'provider')
      .addSelect('SUM(u.costUsd)', 'cost')
      .addSelect('COUNT(*)::int', 'calls')
      .where('u.createdAt >= :todayStart', { todayStart })
      .groupBy('u.provider')
      .getRawMany();

    const today = this.aggregateByProvider(todayRows);

    // MTD stats
    const mtdRows = await this.apiUsageRepo
      .createQueryBuilder('u')
      .select('u.provider', 'provider')
      .addSelect('SUM(u.costUsd)', 'cost')
      .addSelect('COUNT(*)::int', 'calls')
      .where('u.createdAt >= :mtdStart', { mtdStart })
      .groupBy('u.provider')
      .getRawMany();

    const mtd = this.aggregateByProvider(mtdRows);

    // Previous month stats
    const prevMonthRows = await this.apiUsageRepo
      .createQueryBuilder('u')
      .select('SUM(u.costUsd)', 'cost')
      .addSelect('COUNT(*)::int', 'calls')
      .where('u.createdAt >= :prevMonthStart AND u.createdAt <= :prevMonthEnd', {
        prevMonthStart,
        prevMonthEnd,
      })
      .getRawOne();

    const prevMonth = {
      totalCost: parseFloat(prevMonthRows?.cost || '0'),
      totalCalls: parseInt(prevMonthRows?.calls || '0', 10),
    };

    // Forecast: extrapolate MTD to full month
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const forecast = dayOfMonth > 0 ? (mtd.totalCost / dayOfMonth) * daysInMonth : 0;

    // Error rate (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const errorStats = await this.apiUsageRepo
      .createQueryBuilder('u')
      .select('COUNT(*)::int', 'total')
      .addSelect(`SUM(CASE WHEN u.status = 'error' THEN 1 ELSE 0 END)::int`, 'errors')
      .where('u.createdAt >= :weekAgo', { weekAgo })
      .getRawOne();

    const totalCalls = parseInt(errorStats?.total || '0', 10);
    const errorCalls = parseInt(errorStats?.errors || '0', 10);
    const errorRate = totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 10000) / 100 : 0;

    return {
      today,
      mtd,
      prevMonth,
      forecast: Math.round(forecast * 100) / 100,
      errorRate,
    };
  }

  async getApiUsageDaily(from: Date, to: Date): Promise<DailyUsage[]> {
    const rows = await this.apiUsageRepo
      .createQueryBuilder('u')
      .select("TO_CHAR(u.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('u.provider', 'provider')
      .addSelect('SUM(u.costUsd)', 'cost')
      .addSelect('COUNT(*)::int', 'calls')
      .where('u.createdAt >= :from AND u.createdAt <= :to', { from, to })
      .groupBy("TO_CHAR(u.createdAt, 'YYYY-MM-DD')")
      .addGroupBy('u.provider')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Group by date
    const dateMap = new Map<string, DailyUsage>();
    for (const row of rows) {
      const date = row.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, totalCost: 0, totalCalls: 0, byProvider: {} });
      }
      const entry = dateMap.get(date)!;
      const cost = parseFloat(row.cost || '0');
      const calls = parseInt(row.calls || '0', 10);
      entry.totalCost += cost;
      entry.totalCalls += calls;
      entry.byProvider[row.provider] = { cost: Math.round(cost * 1000000) / 1000000, calls };
    }

    // Round totals
    for (const entry of dateMap.values()) {
      entry.totalCost = Math.round(entry.totalCost * 1000000) / 1000000;
    }

    return Array.from(dateMap.values());
  }

  async getApiUsageMonthly(year: number): Promise<MonthlyUsage[]> {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const rows = await this.apiUsageRepo
      .createQueryBuilder('u')
      .select("EXTRACT(MONTH FROM u.createdAt)::int", 'month')
      .addSelect('u.provider', 'provider')
      .addSelect('SUM(u.costUsd)', 'cost')
      .addSelect('COUNT(*)::int', 'calls')
      .where('u.createdAt >= :yearStart AND u.createdAt <= :yearEnd', { yearStart, yearEnd })
      .groupBy("EXTRACT(MONTH FROM u.createdAt)")
      .addGroupBy('u.provider')
      .orderBy('month', 'ASC')
      .getRawMany();

    const monthMap = new Map<number, MonthlyUsage>();
    for (const row of rows) {
      const month = parseInt(row.month, 10);
      if (!monthMap.has(month)) {
        monthMap.set(month, { month, totalCost: 0, totalCalls: 0, byProvider: {} });
      }
      const entry = monthMap.get(month)!;
      const cost = parseFloat(row.cost || '0');
      const calls = parseInt(row.calls || '0', 10);
      entry.totalCost += cost;
      entry.totalCalls += calls;
      entry.byProvider[row.provider] = { cost: Math.round(cost * 1000000) / 1000000, calls };
    }

    for (const entry of monthMap.values()) {
      entry.totalCost = Math.round(entry.totalCost * 1000000) / 1000000;
    }

    return Array.from(monthMap.values());
  }

  private aggregateByProvider(rows: any[]): {
    totalCost: number;
    totalCalls: number;
    byProvider: Record<string, { cost: number; calls: number }>;
  } {
    let totalCost = 0;
    let totalCalls = 0;
    const byProvider: Record<string, { cost: number; calls: number }> = {};

    for (const row of rows) {
      const cost = parseFloat(row.cost || '0');
      const calls = parseInt(row.calls || '0', 10);
      totalCost += cost;
      totalCalls += calls;
      byProvider[row.provider] = { cost: Math.round(cost * 1000000) / 1000000, calls };
    }

    return {
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      totalCalls,
      byProvider,
    };
  }
}
