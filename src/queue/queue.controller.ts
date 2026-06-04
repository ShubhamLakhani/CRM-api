import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@ApiTags('queue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('queue')
export class QueueController {
  constructor(
    @InjectQueue('dead-letter') private readonly deadLetterQueue: Queue,
  ) {}

  @Get('dead-letter')
  @RequirePermissions('billing.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get dead letter queue jobs', description: 'Retrieves all failed/dead-lettered jobs from notifications, emails, and automations.' })
  @ApiResponse({ status: 200, description: 'Returns dead-letter jobs.' })
  async getDeadLetterJobs() {
    const [completedJobs, failedJobs] = await Promise.all([
      this.deadLetterQueue.getJobs(['completed']),
      this.deadLetterQueue.getJobs(['failed']),
    ]);

    const allJobs = [...completedJobs, ...failedJobs];

    const formatJob = (job: any) => ({
      id: job.id,
      name: job.name,
      originalQueue: job.data?.originalQueue || 'unknown',
      originalJobId: job.data?.jobId || 'unknown',
      failedReason: job.data?.failedReason || 'unknown',
      failedAt: job.data?.timestamp || (job.processedOn ? new Date(job.processedOn).toISOString() : 'unknown'),
      data: job.data?.data || null,
      attemptsMade: job.attemptsMade,
    });

    return {
      total: allJobs.length,
      jobs: allJobs.map(formatJob).sort((a, b) => {
        const timeA = new Date(a.failedAt).getTime();
        const timeB = new Date(b.failedAt).getTime();
        return timeB - timeA;
      }),
    };
  }
}
