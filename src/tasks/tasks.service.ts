import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto, creatorId: string, organizationId: string) {
    const { title, description, status, priority, dueDate, dealId, assigneeId } = createTaskDto;

    if (dealId) {
      const deal = await this.prisma.deal.findFirst({
        where: { id: dealId, organizationId, deletedAt: null },
      });
      if (!deal) {
        throw new NotFoundException(`Deal not found in this organization`);
      }
    }

    if (assigneeId) {
      const user = await this.prisma.user.findFirst({
        where: { id: assigneeId, organizationId },
      });
      if (!user) {
        throw new NotFoundException(`Assignee not found in this organization`);
      }
    }

    // Build task record
    const task = await this.prisma.task.create({
      data: {
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        dealId: dealId || null,
        assigneeId: assigneeId || creatorId,
        createdById: creatorId,
        organizationId,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    // Auto-record activity logs
    await this.prisma.activity.create({
      data: {
        type: 'SYSTEM_UPDATE',
        description: `Created task "${task.title}"`,
        taskId: task.id,
        dealId: task.dealId,
        organizationId,
        userId: creatorId,
      },
    });

    return task;
  }

  async findAll(query: TasksQueryDto, organizationId: string) {
    const { search, status } = query;

    const where: any = {
      organizationId,
      deletedAt: null, // Exclude soft deleted tasks
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    return this.prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        deal: { select: { id: true, title: true } },
      },
    });
  }

  async findOne(id: string, organizationId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found or belongs to another workspace`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string, organizationId: string) {
    // Assert tenant ownership and active state first
    const existing = await this.findOne(id, organizationId);

    if (updateTaskDto.dealId) {
      const deal = await this.prisma.deal.findFirst({
        where: { id: updateTaskDto.dealId, organizationId, deletedAt: null },
      });
      if (!deal) {
        throw new NotFoundException(`Deal not found in this organization`);
      }
    }

    if (updateTaskDto.assigneeId) {
      const user = await this.prisma.user.findFirst({
        where: { id: updateTaskDto.assigneeId, organizationId },
      });
      if (!user) {
        throw new NotFoundException(`Assignee not found in this organization`);
      }
    }

    const data: any = { ...updateTaskDto };
    if (updateTaskDto.dueDate !== undefined) {
      data.dueDate = updateTaskDto.dueDate ? new Date(updateTaskDto.dueDate) : null;
    }

    const task = await this.prisma.task.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    // Auto-record status updates or properties modification
    if (updateTaskDto.status && updateTaskDto.status !== existing.status) {
      await this.prisma.activity.create({
        data: {
          type: 'SYSTEM_UPDATE',
          description: `Changed task status from ${existing.status} to ${task.status}`,
          taskId: task.id,
          dealId: task.dealId,
          organizationId,
          userId,
        },
      });
    } else {
      await this.prisma.activity.create({
        data: {
          type: 'SYSTEM_UPDATE',
          description: `Updated task "${task.title}" properties`,
          taskId: task.id,
          dealId: task.dealId,
          organizationId,
          userId,
        },
      });
    }

    return task;
  }

  async remove(id: string, userId: string, organizationId: string) {
    // Assert tenant ownership first
    const task = await this.findOne(id, organizationId);

    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.activity.create({
      data: {
        type: 'SYSTEM_UPDATE',
        description: `Soft deleted task "${task.title}"`,
        organizationId,
        userId,
      },
    });

    return { success: true };
  }
}
