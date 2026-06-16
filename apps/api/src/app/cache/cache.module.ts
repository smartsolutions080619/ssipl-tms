import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');

        // Use Redis only if explicitly set and not localhost
        if (redisHost && redisHost !== 'localhost' && redisHost !== '127.0.0.1') {
          const port = configService.get<string>('REDIS_PORT', '6379');
          return {
            stores: [new KeyvRedis(`redis://${redisHost}:${port}`)],
            ttl: 60_000,
          };
        }

        // In-memory fallback — Keyv default store
        const Keyv = require('keyv');
        return {
          stores: [new Keyv({ ttl: 60_000 })],
          ttl: 60_000,
        };
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}