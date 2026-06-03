import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesQueryDto } from './dto/companies-query.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

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

    // Automatically record activity log
    await this.prisma.activity.create({
      data: {
        type: 'SYSTEM_UPDATE',
        description: `Registered enterprise company account "${company.name}"`,
        organizationId,
        userId: creatorId,
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

      await this.prisma.activity.create({
        data: {
          type: 'SYSTEM_UPDATE',
          description: `Created initial opportunity "${deal.title}" with value $${dealValue} linked to company "${company.name}"`,
          dealId: deal.id,
          organizationId,
          userId: creatorId,
        },
      });
    }

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
        include: {
          deals: {
            where: { deletedAt: null },
            select: { value: true },
          },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    // Compute active pipeline value dynamically
    const mappedCompanies = companies.map((comp) => {
      const computedDealValue = comp.deals.reduce((sum, d) => sum + (d.value || 0), 0);
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

    await this.prisma.activity.create({
      data: {
        type: 'SYSTEM_UPDATE',
        description: `Updated profile details for company "${company.name}"`,
        organizationId,
        userId,
      },
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

    await this.prisma.activity.create({
      data: {
        type: 'SYSTEM_UPDATE',
        description: `Soft deleted company profile "${company.name}"`,
        organizationId,
        userId,
      },
    });

    return { success: true };
  }
}
