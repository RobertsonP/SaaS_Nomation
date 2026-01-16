import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: { name: string; slug?: string }) {
    // Generate slug if not provided
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
    
    // Check if slug exists
    const existing = await this.prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      throw new BadRequestException('Organization slug already exists');
    }

    // Create org and add creator as owner
    return this.prisma.organization.create({
      data: {
        name: data.name,
        slug,
        members: {
          create: {
            userId,
            role: 'owner'
          }
        }
      }
    });
  }

  async findByUser(userId: string) {
    return this.prisma.organization.findMany({
      where: {
        members: {
          some: { userId }
        }
      },
      include: {
        members: {
          where: { userId },
          select: { role: true }
        }
      }
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        invites: true
      }
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async revokeInvite(organizationId: string, requesterId: string, inviteId: string) {
    // 1. Verify requester is admin or owner
    const requesterMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: requesterId } }
    });

    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      throw new ForbiddenException('Only admins can revoke invites');
    }

    // 2. Revoke invite
    await this.prisma.organizationInvite.delete({
      where: { id: inviteId, organizationId }
    });

    return { success: true };
  }

  async inviteMember(organizationId: string, inviterId: string, email: string, role: string = 'member') {
    // Verify inviter has permission (admin or owner)
    const inviterMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: inviterId } }
    });

    if (!inviterMembership || (inviterMembership.role !== 'owner' && inviterMembership.role !== 'admin')) {
      throw new ForbiddenException('Only admins can invite members');
    }

    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: existingUser.id } }
      });
      if (existingMembership) {
        throw new BadRequestException('User is already a member');
      }
    }

    // Check existing invite
    const existingInvite = await this.prisma.organizationInvite.findFirst({
      where: { organizationId, email }
    });
    if (existingInvite) {
      return existingInvite; // Return existing invite or update it
    }

    // Create invite
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    return this.prisma.organizationInvite.create({
      data: {
        organizationId,
        email,
        role,
        token,
        expiresAt
      }
    });
  }

  async acceptInvite(userId: string, token: string) {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token }
    });

    if (!invite || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invite token');
    }

    // Verify user email matches invite email (optional security measure, but common)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user.email !== invite.email) {
      // In strict mode we'd fail here, but for MVP let's allow "claim via link" if authenticated
      // throw new ForbiddenException('Invite email does not match logged in user');
    }

    // Add member
    await this.prisma.organizationMember.create({
      data: {
        organizationId: invite.organizationId,
        userId,
        role: invite.role
      }
    });

    // Delete invite
    await this.prisma.organizationInvite.delete({ where: { id: invite.id } });

    return { success: true, organizationId: invite.organizationId };
  }

  async removeMember(organizationId: string, requesterId: string, targetUserId: string) {
    // 1. Verify requester is admin or owner
    const requesterMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: requesterId } }
    });

    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      throw new ForbiddenException('Only admins can remove members');
    }

    // 2. Prevent removing the last owner
    const targetMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } }
    });

    if (!targetMembership) throw new NotFoundException('Member not found');

    if (targetMembership.role === 'owner') {
      const ownerCount = await this.prisma.organizationMember.count({
        where: { organizationId, role: 'owner' }
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner of the organization');
      }
    }

    // 3. Prevent admins from removing owners
    if (requesterMembership.role === 'admin' && targetMembership.role === 'owner') {
      throw new ForbiddenException('Admins cannot remove owners');
    }

    // 4. Remove member
    await this.prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId, userId: targetUserId } }
    });

    return { success: true };
  }

  async delete(organizationId: string, requesterId: string) {
    // 1. Verify requester is owner
    const requesterMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: requesterId } }
    });

    if (!requesterMembership || requesterMembership.role !== 'owner') {
      throw new ForbiddenException('Only owners can delete the organization');
    }

    // 2. Delete everything associated with the organization
    // Projects, project elements, etc. will be deleted via cascade
    await this.prisma.organization.delete({
      where: { id: organizationId }
    });

    return { success: true };
  }

  async updateMemberRole(organizationId: string, requesterId: string, targetUserId: string, newRole: string) {
    // 1. Verify requester is owner or admin
    const requesterMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: requesterId } }
    });

    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      throw new ForbiddenException('Only admins can change roles');
    }

    // 2. Prevent changing roles of owners unless you are an owner
    const targetMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } }
    });

    if (!targetMembership) throw new NotFoundException('Member not found');

    if (targetMembership.role === 'owner' && requesterMembership.role !== 'owner') {
      throw new ForbiddenException('Only owners can change owner roles');
    }

    // 3. Prevent removing the last owner
    if (targetMembership.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await this.prisma.organizationMember.count({
        where: { organizationId, role: 'owner' }
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot change role of the last owner');
      }
    }

    // 4. Update role
    return this.prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
      data: { role: newRole }
    });
  }
}
