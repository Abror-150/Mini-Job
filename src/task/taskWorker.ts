import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { TaskService } from './task.service';
import { TaskStatus } from './entities/task.entity';
import { MockService } from '../mock/mock.service'; // ← import

@Injectable()
export class TaskWorker implements OnModuleInit {
  private logger = new Logger(TaskWorker.name);

  constructor(
    private taskService: TaskService,
    private mockService: MockService, // ← inject
    @InjectQueue('tasks') private taskQueue: Queue,
  ) {}

  onModuleInit() {
    const worker = new Worker(
      'tasks',
      async (job: Job) => {
        const taskId = job.data.taskId;
        const attempts = job.attemptsMade;

        const task = await this.taskService.findOne(taskId);

        await this.taskService.updateStatus(taskId, TaskStatus.PROCESSING);
        this.logger.log(`Processing task ${taskId}, attempt #${attempts + 1}`);

        const result = await this.mockService.processTask(task.payload);

        await this.taskService.updateStatus(taskId, TaskStatus.COMPLETED);
        this.logger.log(`Task ${taskId} completed: ${result.data}`);
      },
      {
        connection: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT),
          password: process.env.REDIS_PASSWORD,
          tls: {},
        },
        concurrency: 5,
      },
    );

    worker.on('failed', async (job: Job, err: Error) => {
      const attempts = job.attemptsMade;
      await this.taskService.storeError(job.data.taskId, err.message, attempts);
      this.logger.error(`Task ${job.id} failed: ${err.message}`);

      if (attempts >= 3) {
        await this.taskService.updateStatus(job.data.taskId, TaskStatus.FAILED);
        this.logger.warn(`Task ${job.id} moved to dead-letter queue`);
      }
    });
  }
}
