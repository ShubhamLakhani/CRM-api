import { Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkHealth() {
    try {
      // Execute a quick raw SQL query to verify database response
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: 'UP',
      };
    } catch (error) {
      return {
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        database: 'DOWN',
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }
}

