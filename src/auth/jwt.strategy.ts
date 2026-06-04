import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-crm-key-change-in-production',
    });
  }

  async validate(payload: { sub: string; email: string; organizationId?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or session expired');
    }

    let organizationId = payload.organizationId;
    if (!organizationId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: { userId: user.id },
      });
      organizationId = member?.organizationId;
    }

    let permissions: string[] = [];
    let activeRole = user.role;

    if (organizationId) {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
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
      if (member) {
        activeRole = member.roleId;
        if (member.role) {
          permissions = member.role.permissions.map((rp) => rp.permission.action);
        }
      }
    }

    return {
      ...user,
      role: activeRole,
      organizationId,
      permissions,
    };
  }
}
