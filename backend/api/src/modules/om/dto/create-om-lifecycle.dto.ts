import { Transform, Type } from 'class-transformer';
import {
  IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, Max,
} from 'class-validator';
import {
  VALID_CONDITION_GRADES,
  VALID_LIFECYCLE_CATEGORIES,
  VALID_RENEWAL_PLAN_STATUSES,
  VALID_RENEWAL_PLAN_TYPES,
} from '../constants/om-lifecycle-catalog';

export class AssessAssetLifecycleDto {
  @IsDateString()
  assessmentDate: string;

  @IsOptional()
  @IsIn(VALID_CONDITION_GRADES as unknown as string[])
  conditionGrade?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  healthIndex?: number;

  @IsOptional()
  @IsString()
  conditionNotes?: string;
}

export class CreateRenewalPlanDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsIn(VALID_LIFECYCLE_CATEGORIES as unknown as string[])
  lifecycleCategory: string;

  @IsIn(VALID_RENEWAL_PLAN_TYPES as unknown as string[])
  planType: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  planYear?: number;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  estimatedCost?: number;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;
}

export class GenerateRenewalPlansDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;

  @IsOptional()
  @IsIn(VALID_LIFECYCLE_CATEGORIES as unknown as string[])
  lifecycleCategory?: string;
}

export class GenerateAnnualRenewalPlanDto {
  @Type(() => Number)
  @IsInt()
  planYear: number;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;
}

export class UpdateRenewalPlanDto {
  @IsOptional()
  @IsIn(VALID_RENEWAL_PLAN_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  estimatedCost?: number;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}
