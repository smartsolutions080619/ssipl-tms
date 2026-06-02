import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './api-key.entity';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  // Generate new API key
  generateApiKey(): { key: string; hash: string; prefix: string } {
    const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 10);
    return { key, hash, prefix };
  }

  // Validate API key
  async validateApiKey(key: string): Promise<ApiKey | null> {
    const hash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash: hash, isActive: true },
    });

    if (!apiKey) return null;

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used
    await this.apiKeyRepo.update(apiKey.id, { lastUsedAt: new Date() });

    return apiKey;
  }

  // Create API key for tenant
  async createApiKey(tenantId: string, name: string): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const { key, hash, prefix } = this.generateApiKey();

    const apiKey = this.apiKeyRepo.create({
      tenantId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
    });

    await this.apiKeyRepo.save(apiKey);
    return { apiKey, rawKey: key };
  }

  async getApiKeysByTenant(tenantId: string) {
    // tenantId se tenant UUID fetch karo
    const result = await this.apiKeyRepo.query(
      `SELECT id FROM public.tenants WHERE slug = $1`,
      [tenantId]
    );
  
    if (!result.length) return [];
  
    const tenantUuid = result[0].id;
  
    const keys = await this.apiKeyRepo.find({
      where: { tenantId: tenantUuid, isActive: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return keys;
  }

  async revokeApiKey(id: string) {
    const key = await this.apiKeyRepo.findOne({ where: { id } });
    if (!key) throw new Error('API key not found');
    key.isActive = false;
    await this.apiKeyRepo.save(key);
    return { message: `API key "${key.name}" revoked successfully` };
  }
}