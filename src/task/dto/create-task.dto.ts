// create-task.dto.ts
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../entities/task.entity';

export enum TaskType {
  EMAIL = 'email',
  REPORT = 'report',
}

export class EmailPayloadDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiProperty({ example: 'Hello' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'This is a test email.' })
  @IsString()
  @IsNotEmpty()
  body: string;
}

export class ReportPayloadDto {
  @ApiProperty({ example: 'sales' })
  @IsString()
  @IsNotEmpty()
  report_type: string;

  @ApiProperty({ example: '2026-03-01' })
  @IsISO8601()
  date_from: string;

  @ApiProperty({ example: '2026-03-03' })
  @IsISO8601()
  date_to: string;

  @ApiProperty({ example: 'manager@gmail.com' })
  @IsString()
  @IsNotEmpty()
  recipient: string;
}

export class CreateTaskDto {
  @ApiProperty({ enum: TaskType })
  @IsEnum(TaskType)
  type: TaskType;

  @ApiProperty({ enum: TaskPriority, default: TaskPriority.NORMAL })
  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @ApiPropertyOptional({
    type: EmailPayloadDto,
    description: 'Payload for email task',
  })
  @IsOptional()
  @IsObject()
  payload?: EmailPayloadDto | ReportPayloadDto;

  @ApiProperty({ example: 'unique-task-key-123' })
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;

  @ApiPropertyOptional({ example: '2026-03-03T12:00:00Z' })
  @IsOptional()
  @IsISO8601()
  scheduled_at?: string;
}
