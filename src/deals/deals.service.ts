import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { DomainEventEmitter } from '../events/domain-event-emitter';
import { DomainEventType } from '../events/domain-events';
import { PlanEntitlementService } from '../subscription/entitlement.service';

@Injectable()
export class DealsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: DomainEventEmitter,
    private planEntitlementService: PlanEntitlementService,
  ) {}

  async create(createDealDto: CreateDealDto, creatorId: string, organizationId: string) {
    const canCreate = await this.planEntitlementService.canCreateDeal(organizationId);
    if (!canCreate) {
      throw new ForbiddenException('Resource limit reached: cannot create deal. Please upgrade your subscription plan.');
    }

    if ((createDealDto as any).companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: (createDealDto as any).companyId, organizationId, deletedAt: null },
      });
      if (!company) {
        throw new NotFoundException(`Company not found in this organization`);
      }
    }

    if (createDealDto.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: createDealDto.contactId, organizationId, deletedAt: null },
      });
      if (!contact) {
        throw new NotFoundException(`Contact not found in this organization`);
      }
    }

    const deal = await this.prisma.deal.create({
      data: {
        ...createDealDto,
        ownerId: creatorId,
        createdById: creatorId,
        organizationId,
      },
    });



    this.eventEmitter.emit(DomainEventType.DEAL_CREATED, {
      dealId: deal.id,
      organizationId,
      userId: creatorId,
      title: deal.title,
      value: deal.value || 0,
    });

    return deal;
  }

  async findAll(organizationId: string) {
    return this.prisma.deal.findMany({
      where: {
        organizationId,
        deletedAt: null, // Exclude soft deleted deals
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string, organizationId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null, // Exclude soft deleted deals
      },
      include: {
        contact: {
          include: {
            company: true,
          },
        },

      },
    });

    if (!deal) {
      throw new NotFoundException(`Deal with ID ${id} not found or belongs to another workspace`);
    }

    return deal;
  }

  async update(id: string, updateDealDto: UpdateDealDto, userId: string, organizationId: string) {
    const existing = await this.findOne(id, organizationId);

    if ((updateDealDto as any).companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: (updateDealDto as any).companyId, organizationId, deletedAt: null },
      });
      if (!company) {
        throw new NotFoundException(`Company not found in this organization`);
      }
    }

    if (updateDealDto.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: updateDealDto.contactId, organizationId, deletedAt: null },
      });
      if (!contact) {
        throw new NotFoundException(`Contact not found in this organization`);
      }
    }

    const deal = await this.prisma.deal.update({
      where: { id },
      data: updateDealDto,
    });

    // Handle stage change updates specifically for neat logs
    if (updateDealDto.stage && updateDealDto.stage !== existing.stage) {


      this.eventEmitter.emit(DomainEventType.DEAL_STAGE_CHANGED, {
        dealId: deal.id,
        organizationId,
        userId,
        fromStage: existing.stage,
        toStage: deal.stage,
      });

      if (deal.stage === 'WON') {
        this.eventEmitter.emit(DomainEventType.DEAL_WON, {
          dealId: deal.id,
          organizationId,
          userId,
          value: deal.value || 0,
        });
      } else if (deal.stage === 'LOST') {
        this.eventEmitter.emit(DomainEventType.DEAL_LOST, {
          dealId: deal.id,
          organizationId,
          userId,
          value: deal.value || 0,
        });
      }
    } else {
      const changes = Object.keys(updateDealDto).join(', ');

      this.eventEmitter.emit(DomainEventType.DEAL_UPDATED, {
        dealId: deal.id,
        organizationId,
        userId,
        changes,
      });
    }

    return deal;
  }

  async remove(id: string, userId: string, organizationId: string) {
    await this.findOne(id, organizationId);

    // Perform SOFT DELETE instead of hard record purging
    await this.prisma.deal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });



    return { success: true };
  }

  async addNote(dealId: string, description: string, userId: string, organizationId: string) {
    const deal = await this.findOne(dealId, organizationId);

    return this.prisma.activity.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: 'deal',
        entityId: dealId,
        action: 'note_added',
        title: 'Note Added',
        description,
      },
    });
  }

  async getStats(organizationId: string) {
    const deals = await this.prisma.deal.findMany({
      where: {
        organizationId,
        deletedAt: null, // Exclude soft deleted deals
      },
    });

    const totalPipelineValue = deals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
    const wonDeals = deals.filter((d: any) => d.stage === 'WON');
    const closedDeals = deals.filter((d: any) => d.stage === 'WON' || d.stage === 'LOST');

    const totalWonValue = wonDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
    const winRate = closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : 0;

    // Get recent activity across all contacts/deals
    const recentActivities = await this.prisma.activity.findMany({
      where: {
        organizationId,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,

    });

    return {
      totalDealsCount: deals.length,
      totalPipelineValue,
      totalWonValue,
      winRate: Math.round(winRate * 10) / 10,
      activeDealsCount: deals.filter((d: any) => d.stage !== 'WON' && d.stage !== 'LOST').length,
      recentActivities,
    };
  }
}
