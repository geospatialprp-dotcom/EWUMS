import { Transform, Type } from 'class-transformer';
import {
  IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min,
} from 'class-validator';
import { OM_CONTRACT_REVIEW_RATINGS } from '../constants/om-contract-catalog';

export class CreateOmContractDto {
  @IsString()
  contractorName: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;

  @IsOptional()
  @IsString()
  contractorContact?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  slaTargets?: Record<string, number>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordContractAttendanceDto {
  @IsDateString()
  attendanceDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  staffRequired: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  staffPresent: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordContractKpiDto {
  @IsDateString()
  periodMonth: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  waterSupplyHoursPerDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pumpAvailabilityPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  nrwPct?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateContractReviewDto {
  @IsDateString()
  reviewDate: string;

  @IsIn(OM_CONTRACT_REVIEW_RATINGS.map((r) => r.code))
  overallRating: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  slaCompliancePct?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
