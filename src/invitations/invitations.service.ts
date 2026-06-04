import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async create(createInviteDto: CreateInviteDto, invitedById: string, organizationId: string) {
    const { email, roleId } = createInviteDto;

    // Validate role hierarchy to prevent privilege escalation
    const roleHierarchy: Record<string, number> = {
      'OWNER': 6,
      'ADMIN': 5,
      'MANAGER': 4,
      'SALES': 3,
      'SUPPORT': 2,
      'VIEWER': 1,
      'USER': 1,
    };

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    let inviterLevel = 1;
    if (org?.ownerId === invitedById) {
      inviterLevel = 6; // Owner has absolute highest priority
    } else {
      const inviterMember = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: invitedById,
          },
        },
      });
      if (!inviterMember) {
        throw new ForbiddenException('Inviter is not a member of this organization');
      }
      inviterLevel = roleHierarchy[inviterMember.roleId] || 1;
    }

    const targetLevel = roleHierarchy[roleId] || 1;

    if (targetLevel > inviterLevel) {
      throw new ForbiddenException('You cannot invite a user with a role higher than your own');
    }

    // Check if user is already a member of the organization
    const existingMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: { equals: email, mode: 'insensitive' } },
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Check if there is already a pending invitation for this email in the organization
    const existingInvite = await this.prisma.organizationInvite.findFirst({
      where: {
        organizationId,
        email: { equals: email, mode: 'insensitive' },
        acceptedAt: null,
      },
    });

    if (existingInvite) {
      // Overwrite the existing invite to renew it with new token and expiration
      return this.prisma.organizationInvite.update({
        where: { id: existingInvite.id },
        data: {
          token,
          roleId,
          invitedById,
          expiresAt,
        },
      });
    }

    return this.prisma.organizationInvite.create({
      data: {
        email: email.toLowerCase(),
        token,
        organizationId,
        roleId,
        invitedById,
        expiresAt,
      },
    });
  }

  async findAllPending(organizationId: string) {
    return this.prisma.organizationInvite.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async resend(id: string, organizationId: string) {
    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id, organizationId, acceptedAt: null },
    });

    if (!invite) {
      throw new NotFoundException('Pending invitation not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.organizationInvite.update({
      where: { id },
      data: {
        token,
        expiresAt,
      },
    });
  }

  async revoke(id: string, organizationId: string) {
    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id, organizationId, acceptedAt: null },
    });

    if (!invite) {
      throw new NotFoundException('Pending invitation not found');
    }

    await this.prisma.organizationInvite.delete({
      where: { id },
    });

    return { success: true };
  }

  async accept(token: string, userId: string, userEmail: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the invitation using SELECT ... FOR UPDATE to prevent race conditions
      const invites = await tx.$queryRaw<any[]>`
        SELECT * FROM "OrganizationInvite" WHERE "token" = ${token} LIMIT 1 FOR UPDATE
      `;
      const invite = invites[0];

      if (!invite) {
        throw new NotFoundException('Invitation not found or invalid token');
      }

      if (invite.acceptedAt) {
        throw new BadRequestException('Invitation has already been accepted');
      }

      if (new Date() > invite.expiresAt) {
        throw new BadRequestException('Invitation has expired');
      }

      if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw new BadRequestException('This invitation was sent to a different email address');
      }

      // Check if already a member
      const existingMember = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId,
          },
        },
      });

      if (!existingMember) {
        await tx.organizationMember.create({
          data: {
            organizationId: invite.organizationId,
            userId,
            roleId: invite.roleId,
            invitedBy: invite.invitedById,
          },
        });
      }

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: {
          acceptedAt: new Date(),
        },
      });

      const org = await tx.organization.findUnique({
        where: { id: invite.organizationId },
      });

      return {
        success: true,
        organizationId: invite.organizationId,
        organizationName: org?.name || 'New Workspace',
      };
    });
  }

  async validateToken(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invitation not found or invalid token');
    }

    let invitationStatus: 'PENDING' | 'ACCEPTED' | 'EXPIRED' = 'PENDING';
    if (invite.acceptedAt) {
      invitationStatus = 'ACCEPTED';
    } else if (new Date() > invite.expiresAt) {
      invitationStatus = 'EXPIRED';
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: invite.email, mode: 'insensitive' } },
    });

    return {
      organizationName: invite.organization.name,
      role: invite.roleId,
      invitedEmail: invite.email,
      invitationStatus,
      userExists: !!user,
    };
  }

  async registerAndAccept(body: any, ipAddress: string, userAgent: string) {
    const { token, name, password } = body;

    if (!token || !name || !password) {
      throw new BadRequestException('Token, name, and password are required');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Lock the invitation using SELECT ... FOR UPDATE to prevent race conditions
      const invites = await tx.$queryRaw<any[]>`
        SELECT * FROM "OrganizationInvite" WHERE "token" = ${token} LIMIT 1 FOR UPDATE
      `;
      const invite = invites[0];

      if (!invite) {
        throw new NotFoundException('Invitation not found or invalid token');
      }

      if (invite.acceptedAt) {
        throw new BadRequestException('Invitation has already been accepted');
      }

      if (new Date() > invite.expiresAt) {
        throw new BadRequestException('Invitation has expired');
      }

      // Check if user already exists
      const existingUser = await tx.user.findFirst({
        where: { email: { equals: invite.email, mode: 'insensitive' } },
      });

      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser = await tx.user.create({
        data: {
          email: invite.email.toLowerCase(),
          passwordHash,
          name,
          role: invite.roleId,
        },
      });

      // Create organization member
      await tx.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: newUser.id,
          roleId: invite.roleId,
          invitedBy: invite.invitedById,
        },
      });

      // Mark invitation accepted
      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: {
          acceptedAt: new Date(),
        },
      });

      return { newUser, organizationId: invite.organizationId };
    });

    // Delegate to AuthService to create session and return response
    return this.authService.createSessionAndTokens(result.newUser, result.organizationId, ipAddress, userAgent);
  }
}
