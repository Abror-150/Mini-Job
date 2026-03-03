import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateTaskDto } from './dto/create-task.dto';

interface TaskQueryDto {
  status?: TaskStatus;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,

    @InjectQueue('tasks')
    private taskQueue: Queue,
  ) {}
  async create(taskData: CreateTaskDto & { user_id: string }) {
    const existing = await this.taskRepo.findOne({
      where: { idempotency_key: taskData.idempotency_key },
    });
    if (existing) return existing;

    const task = this.taskRepo.create(taskData);
    const savedTask = await this.taskRepo.save(task);

    await this.taskQueue.add(
      'task-job',
      { taskId: savedTask.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    return savedTask;
  }

  async getMetrics() {
    const total = await this.taskRepo.count();

    const countsByStatus = await this.taskRepo
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('task.status')
      .getRawMany();

    const avgTimeRaw = await this.taskRepo
      .createQueryBuilder('task')
      .select(
        'AVG(EXTRACT(EPOCH FROM (task.completed_at - task.started_at))*1000)',
        'avgMs',
      )
      .where('task.completed_at IS NOT NULL')
      .getRawOne();

    const avgProcessingTime = Number(avgTimeRaw.avgms || 0);

    return {
      total,
      countsByStatus,
      avgProcessingTime,
    };
  }

  findAllForUser(userId: string) {
    return this.taskRepo.find({ where: { user_id: userId } });
  }

  async findAll(userId: string, isAdmin: boolean, query: TaskQueryDto) {
    const qb = this.taskRepo.createQueryBuilder('task');

    if (!isAdmin) {
      qb.where('task.user_id = :userId', { userId });
    }

    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }

    if (query.type) {
      qb.andWhere('task.type = :type', { type: query.type });
    }

    if (query.from) {
      qb.andWhere('task.created_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('task.created_at <= :to', { to: query.to });
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    qb.skip((page - 1) * limit).take(limit);

    qb.orderBy('task.created_at', 'DESC');

    const [tasks, total] = await qb.getManyAndCount();

    return {
      data: tasks,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  findOne(id: string) {
    return this.taskRepo.findOne({ where: { id } });
  }

  async cancel(id: string) {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) return null;

    if (task.status === TaskStatus.PENDING) {
      task.status = TaskStatus.CANCELLED;
      return this.taskRepo.save(task);
    }

    return null;
  }
  async updateStatus(id: string, status: TaskStatus) {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) return null;
    task.status = status;
    return this.taskRepo.save(task);
  }

  async storeError(id: string, error: string, attempts: number) {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) return null;
    task.last_error = error;
    task.attempts = attempts;
    return this.taskRepo.save(task);
  }
}
