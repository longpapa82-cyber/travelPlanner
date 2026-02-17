import { Module, Global, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

const logger = new Logger('AppCacheModule');

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        if (redisHost) {
          try {
            const store = await redisStore({
              host: redisHost,
              port: redisPort,
              ...(redisPassword && { password: redisPassword }),
              ttl: 300,
              connectTimeout: 5000,
              maxRetriesPerRequest: 3,
            });
            logger.log(`Using Redis cache at ${redisHost}:${redisPort}`);
            return { store, ttl: 300000 };
          } catch (error) {
            logger.warn(
              `Redis connection failed at ${redisHost}:${redisPort}: ${error instanceof Error ? error.message : String(error)}, falling back to in-memory cache`,
            );
          }
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
