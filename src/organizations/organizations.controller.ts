import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { OrganizationsService } from './organizations.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { SwitchOrgDto } from './dto/switch-org.dto';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly authService: AuthService,
  ) {}

  @Get('my-organizations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all organizations user is a member of' })
  @ApiResponse({
    status: 200,
    description: 'List of organization memberships with roles',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'dff69b6e-453e-46d2-a9c3-af51bf539652' },
          organizationId: { type: 'string', example: '86d5335b-4107-4co8-b1bc-dd07c5d7ddb4' },
          userId: { type: 'string', example: 'c8a04a8f-196a-43d1-9b13-e08e4364ca4e' },
          roleId: { type: 'string', example: 'ADMIN' },
          joinedAt: { type: 'string', example: '2026-06-04T12:00:00.000Z' },
          organization: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '86d5335b-4107-4co8-b1bc-dd07c5d7ddb4' },
              name: { type: 'string', example: 'Workspace A' },
              slug: { type: 'string', example: 'workspace-a' },
            },
          },
        },
      },
    },
  })
  async getMyOrganizations(@GetUser('id') userId: string) {
    return this.organizationsService.getMyOrganizations(userId);
  }

  @Post('switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch active organization context' })
  @ApiResponse({
    status: 200,
    description: 'Active workspace context switched successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOi...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'c8a04a8f-196a-43d1-9b13-e08e4364ca4e' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            role: { type: 'string', example: 'ADMIN' },
            organizationId: { type: 'string', example: '86d5335b-...' },
            organizationName: { type: 'string', example: 'Workspace A' },
            activeOrganizationId: { type: 'string', example: '86d5335b-...' },
            activeOrganizationRole: { type: 'string', example: 'ADMIN' },
            permissions: { type: 'array', items: { type: 'string' }, example: ['deals.create', 'contacts.create'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized context or session expired.' })
  @ApiResponse({ status: 403, description: 'User does not belong to the target organization.' })
  async switch(
    @Body() switchOrgDto: SwitchOrgDto,
    @GetUser('id') userId: string,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { organizationId } = switchOrgDto;
    // Extract refresh token from cookie
    const cookieHeader = req.headers.cookie;
    let refreshToken = '';
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, c) => {
        const [key, val] = c.trim().split('=');
        if (key && val) acc[key] = val;
        return acc;
      }, {} as Record<string, string>);
      refreshToken = cookies['refreshToken'] || '';
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';

    // Delegate the switch logic to authService, which validates membership and updates the active session
    const result = await this.authService.switchOrganization(refreshToken, organizationId, ip, ua, userId);

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
