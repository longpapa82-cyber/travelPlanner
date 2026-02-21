import {
  Injectable,
  OnModuleDestroy,
  BeforeApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Global shutdown flag — checked by the health endpoint to return 503
 * during graceful shutdown, signaling Nginx to stop routing new traffic.
 */
export let isShuttingDown = false;

/** Drain period in ms — time to wait for in-flight requests after signaling unhealthy */
const DRAIN_PERIOD_MS = 10_000;

@Injectable()
export class LifecycleService
  implements BeforeApplicationShutdown, OnModuleDestroy
{
  private readonly logger = new Logger(LifecycleService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Phase 1: Signal shutdown → health returns 503 → Nginx stops routing.
   * Wait DRAIN_PERIOD_MS for in-flight requests to complete.
   */
  async beforeApplicationShutdown(signal?: string) {
    this.logger.log(
      `Shutdown signal received: ${signal ?? 'unknown'} — starting connection drain`,
    );
    isShuttingDown = true;

    // Wait for in-flight requests to complete (Nginx polls health every 10-30s)
    await new Promise((resolve) => setTimeout(resolve, DRAIN_PERIOD_MS));
    this.logger.log('Drain period complete');
  }

  /**
   * Phase 2: Close database connections after all requests are drained.
   */
  async onModuleDestroy() {
    this.logger.log('Graceful shutdown: closing DB connections...');

    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.logger.log('DB connection pool closed');
    }
  }
}
