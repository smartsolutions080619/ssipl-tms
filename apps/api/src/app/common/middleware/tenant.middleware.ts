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
      const tenantId = (
        Array.isArray(req.headers['x-tenant-id'])
          ? req.headers['x-tenant-id'][0]
          : req.headers['x-tenant-id'] as string
      )?.trim() || 'ssipl';
    
      // Sanitize
      if (!/^[a-zA-Z0-9_]+$/.test(tenantId)) {
        throw new BadRequestException('Invalid Tenant ID format');
      }
    
      const schemaName = `tenant_${tenantId}`;
      await this.dataSource.query(`SET search_path TO ${schemaName}, public`);
    
      req.tenantId = tenantId;
      req.schemaName = schemaName;
    
      next();
    }
  }