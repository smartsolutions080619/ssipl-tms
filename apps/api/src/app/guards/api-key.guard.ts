import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
  } from '@nestjs/common';
  import { ApiKeyService } from '../auth/api-key.service';
  
  @Injectable()
  export class ApiKeyGuard implements CanActivate {
    constructor(private readonly apiKeyService: ApiKeyService) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
  
      const apiKey =
        request.headers['x-api-key'] ||
        request.query['api_key'];
  
      if (!apiKey) {
        throw new UnauthorizedException('API key is required');
      }
  
      const validKey = await this.apiKeyService.validateApiKey(apiKey);
  
      if (!validKey) {
        throw new UnauthorizedException('Invalid or expired API key');
      }
  
      // Attach to request
      request.apiKey = validKey;
      request.tenantId = validKey.tenantId;
  
      return true;
    }
  }