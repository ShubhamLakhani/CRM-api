import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesQueryDto } from './dto/companies-query.dto';
import { DomainEventEmitter } from '../events/domain-event-emitter';
import { DomainEventType } from '../events/domain-events';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: DomainEventEmitter,
  ) {}

  async create(createCompanyDto: CreateCompanyDto, creatorId: string, organizationId: string) {
    const { name, domain, industry, employees, dealValue } = createCompanyDto;

    // Create the Company record
    const company = await this.prisma.company.create({
      data: {
        name,
        domain,
        industry,
        employees,
        organizationId,
        createdById: creatorId,
      },
    });

    // If an initial deal value was specified, automatically provision a default lead deal linked to the company
    if (dealValue && dealValue > 0) {
      const deal = await this.prisma.deal.create({
        data: {
          title: `${company.name} Initial Opportunity`,
          value: dealValue,
          stage: 'LEAD',
          companyId: company.id,
          ownerId: creatorId,
          createdById: creatorId,
          organizationId,
        },
      });
    }

    this.eventEmitter.emit(DomainEventType.COMPANY_CREATED, {
      companyId: company.id,
      organizationId,
      userId: creatorId,
      name: company.name,
    });

    return company;
  }

  async findAll(queryDto: CompaniesQueryDto, organizationId: string) {
    const { page = 1, limit = 100, search, industry } = queryDto;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      deletedAt: null, // Exclude soft deleted records
    };

    if (industry) {
      where.industry = industry;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    // Query aggregated deal values database-side using groupBy to optimize performance and memory footprint
    const companyIds = companies.map((c) => c.id);
    const dealValueMap = new Map<string, number>();

    if (companyIds.length > 0) {
      const dealAggregates = await this.prisma.deal.groupBy({
        by: ['companyId'],
        where: {
          companyId: { in: companyIds },
          deletedAt: null,
          organizationId,
        },
        _sum: {
          value: true,
        },
      });

      dealAggregates.forEach((agg) => {
        if (agg.companyId) {
          dealValueMap.set(agg.companyId, agg._sum.value || 0);
        }
      });
    }

    const mappedCompanies = companies.map((comp) => {
      const computedDealValue = dealValueMap.get(comp.id) || 0;
      return {
        id: comp.id,
        name: comp.name,
        domain: comp.domain,
        industry: comp.industry,
        employees: comp.employees,
        createdAt: comp.createdAt,
        updatedAt: comp.updatedAt,
        organizationId: comp.organizationId,
        createdById: comp.createdById,
        dealValue: computedDealValue,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: mappedCompanies,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        deals: { where: { deletedAt: null } },
        contacts: { where: { deletedAt: null } },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found or belongs to another workspace`);
    }

    const dealValue = company.deals.reduce((sum, d) => sum + (d.value || 0), 0);

    return {
      ...company,
      dealValue,
    };
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto, userId: string, organizationId: string) {
    // Assert tenant ownership and active state first
    await this.findOne(id, organizationId);

    const company = await this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
    });

    const changes = Object.keys(updateCompanyDto).join(', ');

    this.eventEmitter.emit(DomainEventType.COMPANY_UPDATED, {
      companyId: company.id,
      organizationId,
      userId,
      changes,
    });

    return company;
  }

  async remove(id: string, userId: string, organizationId: string) {
    // Assert tenant ownership and active state first
    const company = await this.findOne(id, organizationId);

    await this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
