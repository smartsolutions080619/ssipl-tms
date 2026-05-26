import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { Permission } from '../enums/roles.enum';
  import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
  
  @Injectable()
  export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) {}
  
    canActivate(context: ExecutionContext): boolean {
      const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
        PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );
  
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }
  
      const request = context.switchToHttp().getRequest();
      const user = request.user;
  
      if (!user) {
        throw new ForbiddenException('Access denied');
      }
  
      const userPermissions: string[] = user.permissions || [];
      const hasPermission = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );
  
      if (!hasPermission) {
        throw new ForbiddenException(
          `Access denied. Missing required permissions.`,
        );
      }
  
      return true;
    }
  }