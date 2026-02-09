import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');

        if (redisHost) {
          return {
            store: redisStore,
            host: redisHost,
            port: configService.get<number>('REDIS_PORT', 6379),
            ttl: 300000, // 5 minutes default
          };
        }

        // Fallback to in-memory cache for local dev
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
