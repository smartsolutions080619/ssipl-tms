import {
    Injectable,
    ConflictException,
    InternalServerErrorException,
    Logger,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository, DataSource } from 'typeorm';
  import { Tenant } from './tenant.entity';
  import { CreateTenantDto } from './dto/create-tenant.dto';
  import * as crypto from 'crypto';
  
  @Injectable()
  export class TenantService {
    private readonly logger = new Logger(TenantService.name);
  
    constructor(
      @InjectRepository(Tenant)
      private readonly tenantRepo: Repository<Tenant>,
      private readonly dataSource: DataSource,
    ) {}
  
    async createTenant(dto: CreateTenantDto) {
      const existing = await this.tenantRepo.findOne({
        where: { slug: dto.slug },
      });
  
      if (existing) {
        throw new ConflictException(`Tenant with slug "${dto.slug}" already exists`);
      }
  
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
  
      try {
        // 1. Tenant create karo
        const tenant = queryRunner.manager.create(Tenant, {
          name: dto.name,
          slug: dto.slug,
        });
        await queryRunner.manager.save(tenant);
  
        // 2. Tenant schema create karo
        await queryRunner.query(`SELECT create_tenant_schema($1)`, [dto.slug]);
  
        // 3. API Key generate karo — same queryRunner mein
        const rawKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const keyPrefix = rawKey.substring(0, 10);
  
        await queryRunner.query(
          `INSERT INTO public.api_keys (tenant_id, name, key_hash, key_prefix)
           VALUES ($1, $2, $3, $4)`,
          [tenant.id, dto.apiKeyName, keyHash, keyPrefix],
        );
  
        await queryRunner.commitTransaction();
  
        return {
          tenant,
          apiKey: {
            name: dto.apiKeyName,
            prefix: keyPrefix,
            key: rawKey,
          },
          message: 'Tenant created! Save your API key — it will not be shown again!',
        };
      } catch (error) {
        this.logger.error(error);
        await queryRunner.rollbackTransaction();
        throw new InternalServerErrorException('Failed to create tenant');
      } finally {
        await queryRunner.release();
      }
    }
  
    async getAllTenants() {
      return this.tenantRepo.find({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          createdAt: true,
        } as const,
      });
    }
  }