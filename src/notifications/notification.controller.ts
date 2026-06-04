import { Controller, Get, Patch, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user notifications', description: 'Retrieves a paginated list of notifications for the authenticated user in the current organization.' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean, description: 'Filter only unread notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of notifications per page' })
  @ApiResponse({ status: 200, description: 'Returns list of notifications.' })
  findAll(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
    @Query('unreadOnly') unreadOnly?: string | boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const isUnreadOnly = unreadOnly === 'true' || unreadOnly === true;
    return this.notificationService.getUserNotifications(userId, organizationId, {
      unreadOnly: isUnreadOnly,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get unread notifications count', description: 'Returns the total count of unread notifications for the authenticated user.' })
  @ApiResponse({ status: 200, description: 'Returns unread count.' })
  getUnreadCount(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationService.getUnreadCount(userId, organizationId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read', description: 'Marks a single notification as read.' })
  @ApiResponse({ status: 200, description: 'Notification updated successfully.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  markAsRead(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationService.markAsRead(id, userId, organizationId);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read', description: 'Marks all unread notifications for the authenticated user in the current organization as read.' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
  markAllAsRead(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.notificationService.markAllAsRead(userId, organizationId);
  }
}
