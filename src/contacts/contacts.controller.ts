import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactsQueryDto } from './dto/contacts-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @RequirePermissions('contacts.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new contact lead', description: 'Registers a contact and binds it automatically to the logged-in user\'s Organization.' })
  @ApiResponse({ status: 201, description: 'The contact has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation failed or invalid UUIDs provided.' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  create(
    @Body() createContactDto: CreateContactDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.contactsService.create(createContactDto, userId, organizationId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List contacts registry', description: 'Retrieves all active contacts in the active Organization matching search, pagination, and filter queries.' })
  @ApiResponse({ status: 200, description: 'Returns a list of contacts with pagination metadata.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  findAll(
    @Query() queryDto: ContactsQueryDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.contactsService.findAll(queryDto, organizationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get contact details', description: 'Retrieves comprehensive property cards, deals history, and audit timeline for a specific contact UUID.' })
  @ApiResponse({ status: 200, description: 'Returns detailed contact metrics.' })
  @ApiResponse({ status: 404, description: 'Contact not found, soft deleted, or belongs to another organization.' })
  findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.contactsService.findOne(id, organizationId);
  }

  @Patch(':id')
  @RequirePermissions('contacts.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update contact coordinates', description: 'Updates specific property fields of an active contact and records an audit log.' })
  @ApiResponse({ status: 200, description: 'Contact details successfully updated.' })
  @ApiResponse({ status: 404, description: 'Contact not found or invalid access permissions.' })
  update(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.contactsService.update(id, updateContactDto, userId, organizationId);
  }

  @Delete(':id')
  @RequirePermissions('contacts.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a contact', description: 'Flags `deletedAt` with a timestamp to hide the record from active queries, preserving database logs.' })
  @ApiResponse({ status: 200, description: 'Contact successfully soft deleted.' })
  @ApiResponse({ status: 404, description: 'Contact not found or invalid access permissions.' })
  remove(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.contactsService.remove(id, userId, organizationId);
  }
}
