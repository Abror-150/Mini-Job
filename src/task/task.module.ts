import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { Task } from './entities/task.entity';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaskWorker } from './taskWorker';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Task]),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: `rediss://default:${config.get('REDIS_PASSWORD')}@${config.get('REDIS_HOST')}:${config.get('REDIS_PORT')}`,
      }),
    }),
    BullModule.registerQueue({ name: 'tasks' }),
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskWorker],
})
export class TaskModule {}
