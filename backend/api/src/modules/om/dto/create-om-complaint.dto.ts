import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { VALID_COMPLAINT_CHANNELS, VALID_COMPLAINT_TYPES } from '../constants/om-complaint-catalog';

export class CreateOmComplaintDto {
  @IsIn(VALID_COMPLAINT_TYPES as unknown as string[])
  complaintType: string;

  @IsIn(VALID_COMPLAINT_CHANNELS as unknown as string[])
  channel: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsUUID()
  omConsumerId?: string;

  @IsOptional()
  @IsString()
  fhtcNumber?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;
}

export class AdvanceOmComplaintDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsUUID('loose')
  assignedTo?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @IsOptional()
  @IsString()
  consumerFeedback?: string;
}
