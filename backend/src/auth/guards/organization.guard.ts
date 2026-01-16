import { CanActivate, ExecutionContext, Injectable, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const RequireRole = (role: string) => SetMetadata('role', role);

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.get<string>('role', context.getHandler());
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract organizationId from params, body, or query
    let orgId = request.params.organizationId || request.body.organizationId || request.query.organizationId;

    // If organizationId not provided, auto-detect from user's membership
    if (!orgId) {
      const membership = await this.prisma.organizationMember.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' }, // Get first/primary organization
        select: { organizationId: true }
      });

      if (membership) {
        orgId = membership.organizationId;
      } else {
        throw new ForbiddenException('User is not a member of any organization');
      }
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { 
        organizationId_userId: { 
          organizationId: orgId, 
          userId: user.id 
        } 
      }
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    const roleHierarchy: Record<string, number> = { 
      owner: 4, 
      admin: 3, 
      member: 2, 
      viewer: 1 
    };
    
    const userRoleLevel = roleHierarchy[membership.role] || 0;
    // If no role is required, just membership is enough (level 0)
    const requiredRoleLevel = requiredRole ? (roleHierarchy[requiredRole] || 0) : 0;

    if (userRoleLevel < requiredRoleLevel) {
      throw new ForbiddenException(`Requires ${requiredRole} role or higher`);
    }

    // Attach organization to request for controllers to use
    const organization = await this.prisma.organization.findUnique({ where: { id: orgId } });
    request.organization = organization;
    
    return true;
  }
}