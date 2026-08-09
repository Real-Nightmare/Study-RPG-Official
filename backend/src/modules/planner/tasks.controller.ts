import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, CompleteTaskDto } from './dto/task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List study tasks' })
  @ApiQuery({ name: 'status', required: false, enum: ['todo', 'in_progress', 'done'] })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['homework', 'revision', 'exam_prep', 'project', 'reading', 'practice'],
  })
  @ApiQuery({
    name: 'parentId',
    required: false,
    description: 'Filter by parent (subtasks). Omit for top-level tasks.',
  })
  @ApiResponse({ status: 200, description: 'Tasks returned' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.tasksService.list(user.sub, {
      status,
      type,
      parentId: parentId === undefined ? undefined : parentId,
    });
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's task summary" })
  @ApiResponse({ status: 200, description: 'Today summary returned' })
  async todaySummary(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getTodaySummary(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({ status: 200, description: 'Task found' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tasksService.findByIdWithAccess(id, user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  @ApiResponse({ status: 201, description: 'Task created' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.sub, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, user.sub, dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a task as done' })
  @ApiResponse({ status: 200, description: 'Task completed' })
  async complete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.tasksService.complete(id, user.sub, dto);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen a completed task' })
  @ApiResponse({ status: 200, description: 'Task reopened' })
  async reopen(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tasksService.reopen(id, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.tasksService.delete(id, user.sub);
  }
}
