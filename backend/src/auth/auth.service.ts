import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!user || !await bcrypt.compare(data.password, user.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Get user's primary organization
    const primaryOrg = user.memberships[0]?.organization;

    if (!primaryOrg) {
      throw new UnauthorizedException('User has no organization');
    }

    const token = this.jwtService.sign({ userId: user.id });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
      organizationId: primaryOrg.id,
      organization: { id: primaryOrg.id, name: primaryOrg.name },
    };
  }

  async register(data: { name: string; email: string; password: string }) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
      },
    });

    // Create personal organization for user
    const organization = await this.prisma.organization.create({
      data: {
        name: `${user.name}'s Workspace`,
        slug: `user-${user.id}`,
        plan: 'free',
        maxUsers: 1,
        maxExecutions: 100,
      },
    });

    // Add user as owner
    await this.prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
      },
    });

    const token = this.jwtService.sign({ userId: user.id });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
      organizationId: organization.id,
      organization: { id: organization.id, name: organization.name },
    };
  }

  async getFullProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Get user's primary organization (first membership)
    const primaryMembership = user.memberships[0];
    const org = primaryMembership?.organization;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      theme: user.theme,
      timezone: user.timezone,
      organization: org ? {
        id: org.id,
        name: org.name,
        plan: org.plan,
        subscriptionStatus: org.subscriptionStatus || 'inactive',
        currentPeriodEnd: org.currentPeriodEnd,
        cancelAtPeriodEnd: org.cancelAtPeriodEnd,
        maxUsers: org.maxUsers,
        maxExecutions: org.maxExecutions,
      } : null,
      role: primaryMembership?.role || 'member',
    };
  }

  async updateProfile(userId: string, data: { name?: string; theme?: string; timezone?: string }) {
    const updateData: Partial<{ name: string; theme: string; timezone: string }> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.theme !== undefined) updateData.theme = data.theme;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { id: user.id, name: user.name, email: user.email, theme: user.theme, timezone: user.timezone };
  }

  async changePassword(userId: string, data: { currentPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  }

  async getNotificationPreferences(userId: string) {
    const prefs = await this.prisma.userNotificationPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Create default if not exists
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      return this.prisma.userNotificationPreferences.create({
        data: {
          userId,
          notificationEmails: [user.email],
        },
      });
    }

    return prefs;
  }

  async updateNotificationPreferences(userId: string, data: {
    emailFailures?: boolean;
    emailSuccess?: boolean;
    emailWeeklyDigest?: boolean;
    notificationEmails?: string[];
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
  }) {
    // Upsert logic
    return this.prisma.userNotificationPreferences.upsert({
      where: { userId },
      update: {
        emailFailures: data.emailFailures,
        emailSuccess: data.emailSuccess,
        emailWeeklyDigest: data.emailWeeklyDigest,
        notificationEmails: data.notificationEmails,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
      },
      create: {
        userId,
        emailFailures: data.emailFailures,
        emailSuccess: data.emailSuccess,
        emailWeeklyDigest: data.emailWeeklyDigest,
        notificationEmails: data.notificationEmails,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
      },
    });
  }
}