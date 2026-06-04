import { Controller, Get, Post, Body, Param, Delete, UseGuards, HttpCode, HttpStatus, Query, Req, Res } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ValidateInviteDto } from './dto/validate-invite.dto';
import { RegisterAndAcceptDto } from './dto/register-and-accept.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as express from 'express';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users.invite')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a member to the organization' })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'dff69b6e-453e-46d2-a9c3-af51bf539652' },
        email: { type: 'string', example: 'operator@company.com' },
        token: { type: 'string', example: 'a4b2c8e3...' },
        organizationId: { type: 'string', example: '86d5335b-4107-4co8-b1bc-dd07c5d7ddb4' },
        roleId: { type: 'string', example: 'MANAGER' },
        invitedById: { type: 'string', example: 'c8a04a8f-196a-43d1-9b13-e08e4364ca4e' },
        expiresAt: { type: 'string', example: '2026-06-11T12:00:00.000Z' },
        createdAt: { type: 'string', example: '2026-06-04T12:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid role hierarchy or invite role higher than user role.' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async invite(
    @Body() createInviteDto: CreateInviteDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.invitationsService.create(createInviteDto, userId, organizationId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users.invite')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all pending invitations for the organization' })
  @ApiResponse({
    status: 200,
    description: 'List of pending invitations',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'dff69b6e-453e-46d2-a9c3-af51bf539652' },
          email: { type: 'string', example: 'operator@company.com' },
          roleId: { type: 'string', example: 'MANAGER' },
          expiresAt: { type: 'string', example: '2026-06-11T12:00:00.000Z' },
          invitedBy: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'John Owner' },
            },
          },
        },
      },
    },
  })
  async findAll(@GetUser('organizationId') organizationId: string) {
    return this.invitationsService.findAllPending(organizationId);
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users.invite')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a pending invitation' })
  @ApiResponse({
    status: 200,
    description: 'Invitation resent/renewed successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'dff69b6e-453e-46d2-a9c3-af51bf539652' },
        email: { type: 'string', example: 'operator@company.com' },
        token: { type: 'string', example: 'new-token-a4b2c8e3...' },
        expiresAt: { type: 'string', example: '2026-06-11T12:00:00.000Z' },
      },
    },
  })
  async resend(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.invitationsService.resend(id, organizationId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users.invite')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  @ApiResponse({
    status: 200,
    description: 'Invitation revoked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  async revoke(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.invitationsService.revoke(id, organizationId);
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an organization invitation' })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted and organization membership created',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        organizationId: { type: 'string', example: '86d5335b-4107-4co8-b1bc-dd07c5d7ddb4' },
        organizationName: { type: 'string', example: 'Workspace A' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid token, expired token, or target email mismatch.' })
  async accept(
    @Body() acceptInviteDto: AcceptInviteDto,
    @GetUser('id') userId: string,
    @GetUser('email') userEmail: string,
  ) {
    const { token } = acceptInviteDto;
    return this.invitationsService.accept(token, userId, userEmail);
  }

  @Get('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an invitation token' })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    schema: {
      type: 'object',
      properties: {
        organizationName: { type: 'string', example: 'Workspace A' },
        role: { type: 'string', example: 'MANAGER' },
        invitedEmail: { type: 'string', example: 'operator@company.com' },
        invitationStatus: { type: 'string', example: 'PENDING' },
        userExists: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invitation not found or invalid token.' })
  async validate(@Query() validateInviteDto: ValidateInviteDto) {
    const { token } = validateInviteDto;
    return this.invitationsService.validateToken(token);
  }

  @Post('register-and-accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register and accept an invitation' })
  @ApiResponse({
    status: 201,
    description: 'User registered and invitation accepted successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOi...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'c8a04a8f-196a-43d1-9b13-e08e4364ca4e' },
            email: { type: 'string', example: 'operator@company.com' },
            name: { type: 'string', example: 'Jane Doe' },
            role: { type: 'string', example: 'MANAGER' },
            organizationId: { type: 'string', example: '86d5335b-...' },
            organizationName: { type: 'string', example: 'Workspace A' },
            activeOrganizationId: { type: 'string', example: '86d5335b-...' },
            activeOrganizationRole: { type: 'string', example: 'MANAGER' },
            permissions: { type: 'array', items: { type: 'string' }, example: ['deals.create'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Expired token, password constraints, or email mismatch.' })
  async registerAndAccept(
    @Body() registerAndAcceptDto: RegisterAndAcceptDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const result = await this.invitationsService.registerAndAccept(registerAndAcceptDto, ip, ua);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }
}
