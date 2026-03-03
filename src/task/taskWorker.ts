import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { TaskService } from './task.service';
import { TaskStatus } from './entities/task.entity';

@Injectable()
export class TaskWorker implements OnModuleInit {
  private logger = new Logger(TaskWorker.name);

  constructor(
    private taskService: TaskService,
    @InjectQueue('tasks') private taskQueue: Queue,
  ) {}

  onModuleInit() {
    const worker = new Worker(
      'tasks',
      async (job: Job) => {
        const taskId = job.data.taskId;
        const attempts = job.attemptsMade;

        await this.taskService.updateStatus(taskId, TaskStatus.PROCESSING);
        this.logger.log(`Processing task ${taskId}, attempt #${attempts + 1}`);

        const delay = 2000 + Math.random() * 3000;
        await new Promise((res) => setTimeout(res, delay));

        if (Math.random() < 0.25) {
          throw new Error(`Simulated failure for task ${taskId}`);
        }

        await this.taskService.updateStatus(taskId, TaskStatus.COMPLETED);
        this.logger.log(`Task ${taskId} completed successfully`);
      },
      {
        connection: { host: 'localhost', port: 6379 },
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
