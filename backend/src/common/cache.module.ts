import { Module, Global, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import { createConnection } from 'net';

const logger = new Logger('AppCacheModule');

/** Quick TCP check to see if Redis is reachable */
function isRedisReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: 1000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);

        if (redisHost) {
          const reachable = await isRedisReachable(redisHost, redisPort);
          if (reachable) {
            logger.log(`Using Redis cache at ${redisHost}:${redisPort}`);
            return {
              store: redisStore,
              host: redisHost,
              port: redisPort,
              ttl: 300000,
            };
          }
          logger.warn(
            `Redis not reachable at ${redisHost}:${redisPort}, falling back to in-memory cache`,
          );
        }

        // Fallback to in-memory cache
        logger.log('Using in-memory cache');
        return {
          ttl: 300000,
          max: 100,
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
