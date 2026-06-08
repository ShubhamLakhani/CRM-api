import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TemplateResolverService {
  private readonly logger = new Logger(TemplateResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveContext(
    entityType: string,
    entityId: string,
    actorId: string | null,
    organizationId: string,
  ): Promise<any> {
    const context: any = {
      contact: null,
      deal: null,
      task: null,
      invite: null,
      actor: null,
    };

    try {
      if (actorId) {
        context.actor = await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { id: true, name: true, email: true },
        });
      }

      const cleanEntityType = entityType.toLowerCase();

      if (cleanEntityType === 'contact') {
        context.contact = await this.prisma.contact.findFirst({
          where: { id: entityId, organizationId },
        });
      } else if (cleanEntityType === 'deal') {
        context.deal = await this.prisma.deal.findFirst({
          where: { id: entityId, organizationId },
          include: {
            contact: true,
            company: true,
          },
        });
        if (context.deal?.contact) {
          context.contact = context.deal.contact;
        }
      } else if (cleanEntityType === 'task') {
        context.task = await this.prisma.task.findFirst({
          where: { id: entityId, organizationId },
          include: {
            deal: true,
            assignee: true,
          },
        });
        if (context.task?.deal) {
          context.deal = context.task.deal;
        }
      } else if (cleanEntityType === 'invite') {
        context.invite = await this.prisma.organizationInvite.findFirst({
          where: { id: entityId, organizationId },
          include: {
            invitedBy: true,
          },
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to resolve template context for ${entityType}/${entityId}: ${error.message}`, error.stack);
    }

    return context;
  }

  resolveTemplate(template: string | undefined, context: any): string {
    if (!template) return '';
    return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
      const keys = path.split('.');
      let value: any = context;
      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = value[key];
        } else {
          value = undefined;
          break;
        }
      }
      return value !== undefined && value !== null ? String(value) : '';
    });
  }
}
