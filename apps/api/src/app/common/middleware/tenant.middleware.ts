import {
    Injectable,
    NestMiddleware,
    BadRequestException,
  } from '@nestjs/common';
  import { Request, Response, NextFunction } from 'express';
  import { DataSource } from 'typeorm';
  
  declare module 'express' {
    interface Request {
      tenantId?: string;
      schemaName?: string;
    }
  }
  
  @Injectable()
  export class TenantMiddleware implements NestMiddleware {
    constructor(private readonly dataSource: DataSource) {}
  
    async use(req: Request, res: Response, next: NextFunction) {
      const tenantId = req.headers['x-tenant-id'] as string;
  
      if (!tenantId) {
        throw new BadRequestException('X-Tenant-ID header is required');
      }
  
      // Sanitize — only allow alphanumeric and underscores
      if (!/^[a-zA-Z0-9_]+$/.test(tenantId)) {
        throw new BadRequestException('Invalid Tenant ID format');
      }
  
      // Switch PostgreSQL schema for this request
      const schemaName = `tenant_${tenantId}`;
      await this.dataSource.query(`SET search_path TO ${schemaName}, public`);
  
      // Attach tenant info to request
      req.tenantId = tenantId;
      req.schemaName = schemaName;
  
      next();
    }
  }