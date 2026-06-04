import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactsQueryDto } from './dto/contacts-query.dto';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async create(createContactDto: CreateContactDto, creatorId: string, organizationId: string) {
    const { name, email, phone, companyId, status, ownerId } = createContactDto;

    if (companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, organizationId, deletedAt: null },
      });
      if (!company) {
        throw new NotFoundException(`Company not found in this organization`);
      }
    }

    if (ownerId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: { userId: ownerId, organizationId },
      });
      if (!member) {
        throw new NotFoundException(`Assigned owner not found in this organization`);
      }
    }

    // Build contact record
    const contact = await this.prisma.contact.create({
      data: {
        name,
        email,
        phone,
        companyId,
        status: status || 'LEAD',
        organizationId,
        ownerId: ownerId || creatorId,
        createdById: creatorId,
      },
    });

    // Automatically record activity
    await this.prisma.activity.create({
      data: {
        type: 'SYSTEM_UPDATE',
        description: `Created contact ${contact.name}`,
        contactId: contact.id,
        organizationId,
        userId: creatorId,
      },
    });

    return contact;
  }

  async findAll(queryDto: ContactsQueryDto, organizationId: string) {
    const { page = 1, limit = 10, search, status, companyId } = queryDto;
    const skip = (page - 1) * limit;

    // Construct multi-tenant & soft delete queries filters
    const where: any = {
      organizationId,
      deletedAt: null, // Filter out soft deleted records
    };

    if (status) {
      where.status = status;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Retrieve records & total counts concurrently for high performance
    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: { id: true, name: true, domain: true },
          },
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null, // Exclude soft deleted records
      },
      include: {
        company: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        deals: {
          where: { deletedAt: null },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
      },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found or belongs to another workspace`);
    }

    return contact;
  }

  async update(id: string, updateContactDto: UpdateContactDto, userId: string, organizationId: string) {
    // Assert tenant ownership and active state
    await this.findOne(id, organizationId);

    if (updateContactDto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: updateContactDto.companyId, organizationId, deletedAt: null },
      });
      if (!company) {
        throw new NotFoundException(`Company not found in this organization`);
      }
    }

    if (updateContactDto.ownerId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: { userId: updateContactDto.ownerId, organizationId },
      });
      if (!member) {
        throw new NotFoundException(`Assigned owner not found in this organization`);
      }
    }

    const contact = await this.prisma.contact.update({
      where: { id },
      data: updateContactDto,
    });

    // Track changed fields and write logs
    const changes = Object.keys(updateContactDto).join(', ');
    await this.prisma.activity.create({
      data: {
        type: 'SYSTEM_UPDATE',
        description: `Updated contact fields: ${changes}`,
        contactId: contact.id,
        organizationId,
        userId,
      },
    });

    return contact;
  }

  async remove(id: string, userId: string, organizationId: string) {
    // Assert tenant ownership and active state
    const contact = await this.findOne(id, organizationId);

    // Perform SOFT DELETE instead of hard record purging
    await this.prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Log soft-deletion action
    await this.prisma.activity.create({
      data: {
        type: 'SYSTEM_UPDATE',
        description: `Soft deleted contact ${contact.name}`,
        contactId: contact.id,
        organizationId,
        userId,
      },
    });

    return { success: true, message: 'Contact successfully soft deleted' };
  }
}
