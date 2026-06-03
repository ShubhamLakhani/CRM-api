import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesQueryDto } from './dto/companies-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a company profile', description: 'Registers a corporate account and maps it to the user\'s Organization.' })
  @ApiResponse({ status: 201, description: 'The company profile has been created.' })
  @ApiResponse({ status: 400, description: 'Validation failures.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  create(
    @Body() createCompanyDto: CreateCompanyDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.companiesService.create(createCompanyDto, userId, organizationId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List enterprise accounts', description: 'Retrieves all active company profiles in the active Organization matching filters.' })
  @ApiResponse({ status: 200, description: 'Returns list of company profiles.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  findAll(
    @Query() queryDto: CompaniesQueryDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.companiesService.findAll(queryDto, organizationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get company details', description: 'Retrieves corporate details, active deals, and linked contacts for a specific UUID.' })
  @ApiResponse({ status: 200, description: 'Returns detailed company details.' })
  @ApiResponse({ status: 404, description: 'Company not found or invalid access permissions.' })
  findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.companiesService.findOne(id, organizationId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update company properties', description: 'Updates details of an active corporate record.' })
  @ApiResponse({ status: 200, description: 'Company properties successfully updated.' })
  @ApiResponse({ status: 404, description: 'Company not found or invalid access permissions.' })
  update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.companiesService.update(id, updateCompanyDto, userId, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a company profile', description: 'Flags `deletedAt` with a timestamp to hide the record from active queries.' })
  @ApiResponse({ status: 200, description: 'Company successfully soft deleted.' })
  @ApiResponse({ status: 404, description: 'Company not found or invalid access permissions.' })
  remove(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.companiesService.remove(id, userId, organizationId);
  }
}
