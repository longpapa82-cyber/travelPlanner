import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class LifecycleService implements OnModuleDestroy {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleDestroy() {
    this.logger.log('Graceful shutdown: closing DB connections...');

    // Close TypeORM connection pool
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.logger.log('DB connection pool closed');
    }
  }
}
