import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: {
    userId?: string;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const entry = this.auditLogRepository.create(data);
      await this.auditLogRepository.save(entry);
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${err}`);
    }
  }

  async getAuditLogs(
    page = 1,
    limit = 50,
    userId?: string,
    action?: AuditAction,
  ) {
    const qb = this.auditLogRepository
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC');

    if (userId) {
      qb.andWhere('a.userId = :userId', { userId });
    }
    if (action) {
      qb.andWhere('a.action = :action', { action });
    }

    const total = await qb.getCount();
    const logs = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Auto-delete audit logs older than 30 days — runs daily at 4:00 AM */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOldLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await this.auditLogRepository.delete({
      createdAt: LessThan(cutoff),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} audit logs older than 30 days`);
    }
  }
}
