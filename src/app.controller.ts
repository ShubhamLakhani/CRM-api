import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Welcome message', description: 'Returns a simple hello world message to check if API is serving traffic.' })
  @ApiResponse({ status: 200, description: 'Welcome string returned.' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'System Health Check', description: 'Verifies service uptime and validates that database is active.' })
  @ApiResponse({ status: 200, description: 'System health status object' })
  checkHealth() {
    return this.appService.checkHealth();
  }
}

