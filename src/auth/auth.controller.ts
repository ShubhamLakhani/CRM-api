import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GetUser } from './get-user.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Throttle({ default: { limit: 15, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register user', description: 'Creates a new user account along with an associated default Organization.' })
  @ApiResponse({ status: 201, description: 'User registration successful' })
  @ApiResponse({ status: 400, description: 'Email already exists or validation errors' })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const result = await this.authService.register(registerDto, ip, ua);

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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user', description: 'Authenticates user credentials and returns a JWT access token and a refresh token.' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const result = await this.authService.login(loginDto, ip, ua);

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile', description: 'Retrieves info about the authenticated user based on active JWT token.' })
  @ApiResponse({ status: 200, description: 'Profile details returned' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async me(@GetUser() user: any) {
    return user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh user access token', description: 'Regenerates a fresh JWT access token using the refresh token.' })
  @ApiResponse({
    status: 200,
    description: 'Token successfully refreshed',
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
  @ApiResponse({ status: 401, description: 'Invalid refresh request' })
  async refresh(
    @Body() refreshDto: RefreshDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { organizationId } = refreshDto;
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
    const result = await this.authService.refresh(refreshToken, ip, ua, organizationId);

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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from current device session' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
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

    if (refreshToken) {
      await this.authService.logout(refreshToken).catch(() => {});
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });

    return { success: true };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all device sessions' })
  @ApiResponse({ status: 200, description: 'Successfully logged out from all devices' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async logoutAll(
    @GetUser('id') userId: string,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    await this.authService.logoutAll(userId);

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });

    return { success: true };
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get organization users list', description: 'Lists all registered users in the organization.' })
  @ApiResponse({ status: 200, description: 'List of users returned.' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async getUsers(@GetUser('organizationId') organizationId: string) {
    return this.authService.findUsersByOrganization(organizationId);
  }
}
