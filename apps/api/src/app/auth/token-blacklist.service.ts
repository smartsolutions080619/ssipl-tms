import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private blacklist = new Set<string>();

  async blacklistToken(token: string): Promise<void> {
    this.blacklist.add(token);
    this.logger.log(`Token blacklisted`);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    return this.blacklist.has(token);
  }
}