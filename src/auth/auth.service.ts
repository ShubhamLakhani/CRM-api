import { ConflictException, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto, ipAddress: string, userAgent: string) {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

    // Create organization, user, and membership in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: `${name}'s Workspace`,
          slug,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'OWNER',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      // Update org owner
      await tx.organization.update({
        where: { id: org.id },
        data: { ownerId: user.id },
      });

      // Create organization member
      const member = await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          roleId: 'OWNER',
        },
      });

      return { user, org, member };
    });

    const accessToken = this.generateToken(result.user.id, result.user.email, result.org.id);
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store session in DB
    await this.prisma.session.create({
      data: {
        userId: result.user.id,
        tokenHash,
        ipAddress,
        userAgent,
        activeOrganizationId: result.org.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    const permissions = await this.getPermissions(result.user.id, result.org.id);

    return {
      user: {
        ...result.user,
        role: result.member.roleId,
        organizationId: result.org.id,
        organizationName: result.org.name,
        activeOrganizationId: result.org.id,
        activeOrganizationRole: result.member.roleId,
        permissions,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Find organization membership
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (!membership) {
      throw new UnauthorizedException('User is not a member of any organization');
    }

    const organizationId = membership.organizationId;

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.roleId,
      createdAt: user.createdAt,
      organizationId,
      organizationName: membership.organization.name,
      activeOrganizationId: organizationId,
      activeOrganizationRole: membership.roleId,
    };

    const accessToken = this.generateToken(user.id, user.email, organizationId);
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store session in DB
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        activeOrganizationId: organizationId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    const permissions = await this.getPermissions(user.id, organizationId);

    return {
      user: {
        ...userResponse,
        permissions,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string, ipAddress: string, userAgent: string, organizationId?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Find the session in database
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > session.expiresAt) {
      // Session expired, delete it
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      throw new UnauthorizedException('Refresh token expired');
    }

    let targetOrgId = organizationId || session.activeOrganizationId;

    let membership = null;
    if (targetOrgId) {
      membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: targetOrgId,
            userId: session.user.id,
          },
        },
        include: { organization: true },
      });
    }

    if (!membership) {
      membership = await this.prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        include: { organization: true },
        orderBy: { joinedAt: 'asc' },
      });
    }

    if (!membership) {
      throw new UnauthorizedException('User is not a member of any organization');
    }

    const activeOrgId = membership.organizationId;

    // Generate new access and refresh tokens (Refresh Token Rotation)
    const newAccessToken = this.generateToken(session.user.id, session.user.email, activeOrgId);
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    // Update the session in the database
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: newHash,
        ipAddress,
        userAgent,
        activeOrganizationId: activeOrgId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Rotate expiration to 30 days
      },
    });

    const permissions = await this.getPermissions(session.user.id, activeOrgId);

    return {
      user: {
        ...session.user,
        role: membership.roleId,
        organizationId: activeOrgId,
        organizationName: membership.organization.name,
        activeOrganizationId: activeOrgId,
        activeOrganizationRole: membership.roleId,
        permissions,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async createSessionAndTokens(user: any, organizationId: string, ipAddress: string, userAgent: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      include: { organization: true },
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership?.roleId || user.role,
      createdAt: user.createdAt,
      organizationId,
      organizationName: membership?.organization.name || 'New Workspace',
      activeOrganizationId: organizationId,
      activeOrganizationRole: membership?.roleId || user.role,
    };

    const accessToken = this.generateToken(user.id, user.email, organizationId);
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store session in DB
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        activeOrganizationId: organizationId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    const permissions = await this.getPermissions(user.id, organizationId);

    return {
      user: {
        ...userResponse,
        permissions,
      },
      accessToken,
      refreshToken,
    };
  }

  async switchOrganization(
    refreshToken: string | undefined,
    organizationId: string,
    ipAddress: string,
    userAgent: string,
    userId?: string,
  ) {
    let session = null;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      session = await this.prisma.session.findUnique({
        where: { tokenHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });
    }

    if (!session && userId) {
      session = await this.prisma.session.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });
    }

    if (!session) {
      throw new UnauthorizedException('Session not found or expired');
    }

    if (new Date() > session.expiresAt) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      throw new UnauthorizedException('Session expired');
    }

    // Verify membership in the target organization
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.userId,
        },
      },
      include: { organization: true },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    // Generate new access and refresh tokens (Rotate refresh token)
    const newAccessToken = this.generateToken(session.userId, session.user.email, organizationId);
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    // Update the session in the database
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: newHash,
        ipAddress,
        userAgent,
        activeOrganizationId: organizationId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const permissions = await this.getPermissions(session.userId, organizationId);

    return {
      user: {
        ...session.user,
        role: membership.roleId,
        organizationId,
        organizationName: membership.organization.name,
        activeOrganizationId: organizationId,
        activeOrganizationRole: membership.roleId,
        permissions,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.session.deleteMany({
      where: { tokenHash },
    });
  }

  async logoutAll(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async findUsersByOrganization(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        user: { deletedAt: null },
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });
    return members.map(m => m.user);
  }

  private async getPermissions(userId: string, organizationId: string): Promise<string[]> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
    if (!member || !member.role) return [];
    return member.role.permissions.map((rp) => rp.permission.action);
  }

  private generateToken(userId: string, email: string, organizationId: string): string {
    const payload = { sub: userId, email, organizationId };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }
}

