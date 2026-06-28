import {
  IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'on_hold',
  'delayed',
] as const;

export class CreateMilestoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  completedDate?: string;

  @IsOptional()
  @IsIn(MILESTONE_STATUSES)
  status?: (typeof MILESTONE_STATUSES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
