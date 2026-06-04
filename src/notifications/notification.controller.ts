import { Controller, Get, Patch, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import {
  GetNotificationsQueryDto,
  NotificationDto,
  PaginatedNotificationsDto,
  UnreadCountDto,
  MarkAllReadResponseDto,
} from './dto/notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user notifications', description: 'Retrieves a paginated list of notifications for the authenticated user in the current organization.' })
  @ApiResponse({ status: 200, type: PaginatedNotificationsDto, description: 'Returns list of notifications.' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async findAll(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotificationsDto> {
    return this.notificationService.getUserNotifications(userId, organizationId, query);
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get unread notifications count', description: 'Returns the total count of unread notifications for the authenticated user.' })
  @ApiResponse({ status: 200, type: UnreadCountDto, description: 'Returns unread count.' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async getUnreadCount(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<UnreadCountDto> {
    const count = await this.notificationService.getUnreadCount(userId, organizationId);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read', description: 'Marks a single notification as read.' })
  @ApiParam({ name: 'id', description: 'The UUID of the notification', type: String, example: 'd3b07384-d113-4ec2-a5d6-c74b88b7f7e8' })
  @ApiResponse({ status: 200, type: NotificationDto, description: 'Notification updated successfully.' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  async markAsRead(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<NotificationDto> {
    return this.notificationService.markAsRead(id, userId, organizationId);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read', description: 'Marks all unread notifications for the authenticated user in the current organization as read.' })
  @ApiResponse({ status: 200, type: MarkAllReadResponseDto, description: 'All notifications marked as read.' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async markAllAsRead(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<MarkAllReadResponseDto> {
    return this.notificationService.markAllAsRead(userId, organizationId);
  }
}
