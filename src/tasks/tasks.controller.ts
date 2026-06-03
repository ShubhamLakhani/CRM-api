import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new action task', description: 'Registers a task and binds it automatically to the user\'s Organization.' })
  @ApiResponse({ status: 201, description: 'The task has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation failures.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  create(
    @Body() createTaskDto: CreateTaskDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.tasksService.create(createTaskDto, userId, organizationId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List tasks registry', description: 'Retrieves all active tasks in the active Organization matching search and status filters.' })
  @ApiResponse({ status: 200, description: 'Returns a list of tasks.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  findAll(
    @Query() queryDto: TasksQueryDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.tasksService.findAll(queryDto, organizationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get task details', description: 'Retrieves details for a specific task UUID.' })
  @ApiResponse({ status: 200, description: 'Returns detailed task parameters.' })
  @ApiResponse({ status: 404, description: 'Task not found or invalid access permissions.' })
  findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.tasksService.findOne(id, organizationId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task properties', description: 'Updates details of an active task and logs audit trace.' })
  @ApiResponse({ status: 200, description: 'Task successfully updated.' })
  @ApiResponse({ status: 404, description: 'Task not found or invalid access permissions.' })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.tasksService.update(id, updateTaskDto, userId, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a task', description: 'Appends deletedAt timestamp to task record.' })
  @ApiResponse({ status: 200, description: 'Task successfully soft deleted.' })
  @ApiResponse({ status: 404, description: 'Task not found or invalid access permissions.' })
  remove(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.tasksService.remove(id, userId, organizationId);
  }
}
