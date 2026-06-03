import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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
  async register(@Body() registerDto: RegisterDto, @Req() req: express.Request) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    return this.authService.register(registerDto, ip, ua);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user', description: 'Authenticates user credentials and returns a JWT access token and a refresh token.' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password credentials' })
  async login(@Body() loginDto: LoginDto, @Req() req: express.Request) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    return this.authService.login(loginDto, ip, ua);
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
  @ApiResponse({ status: 200, description: 'Token successfully refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh request' })
  async refresh(
    @Body('refreshToken') refreshToken?: string,
    @Body('token') token?: string,
    @Req() req?: express.Request,
  ) {
    const activeToken = refreshToken || token || '';
    const ip = req?.ip || (req?.headers['x-forwarded-for'] as string) || req?.socket.remoteAddress || '';
    const ua = req?.headers['user-agent'] || '';
    return this.authService.refresh(activeToken, ip, ua);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from current device session' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(@Body('refreshToken') refreshToken?: string, @Body('token') token?: string) {
    const activeToken = refreshToken || token || '';
    await this.authService.logout(activeToken);
    return { success: true };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all device sessions' })
  @ApiResponse({ status: 200, description: 'Successfully logged out from all devices' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async logoutAll(@GetUser('id') userId: string) {
    await this.authService.logoutAll(userId);
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


