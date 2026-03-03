import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { JwtAuthGuard } from 'src/auth/strategies/jwt.guard';
import { TaskStatus } from './entities/task.entity';
import { Roles } from 'src/guard/decorator';
import { RolesGuard } from 'src/guard/auth';
import { CreateTaskDto } from './dto/create-task.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Post()
  create(@Body() body: CreateTaskDto, @Req() req) {
    return this.taskService.create({ ...body, user_id: req.user.id });
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('metrics')
  getMetrics() {
    return this.taskService.getMetrics();
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.taskService.cancel(id);
  }

  @ApiBearerAuth()
  @Get()
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TaskStatus,
    description: 'Filter by task status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by task type (email, report, notification)',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'Filter from date (ISO format)',
    example: '2026-03-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'Filter to date (ISO format)',
    example: '2026-03-10',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Items per page',
  })
  async findAll(
    @Req() req,
    @Query('status') status?: TaskStatus,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const query = {
      status,
      type,
      from,
      to,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    };

    return this.taskService.findAll(
      req.user.userId,
      req.user.role === 'ADMIN',
      query,
    );
  }
}
