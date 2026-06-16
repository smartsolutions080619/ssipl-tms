import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST');

        // Use Redis only if explicitly configured and not localhost
        if (redisHost && redisHost !== 'localhost') {
          return {
            redis: {
              host: redisHost,
              port: +configService.get('REDIS_PORT', '6379'),
            },
          };
        }

        // ── Fallback: in-memory (no Redis needed) ──
        return {
          redis: {
            host: '127.0.0.1',
            port: 6379,
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 0,
            retryStrategy: () => null, // don't retry — fail silently
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'emails' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}