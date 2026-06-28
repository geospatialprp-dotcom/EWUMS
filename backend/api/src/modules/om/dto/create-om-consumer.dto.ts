import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { OM_CONSUMER_SERVICE_TYPES } from '../constants/om-consumer-catalog';

export class CreateOmConsumerDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;

  @IsString()
  fhtcNumber: string;

  @IsOptional()
  @IsString()
  consumerName?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  meterNumber?: string;

  @IsOptional()
  @IsString()
  meterType?: string;

  @IsOptional()
  @IsString()
  meterInstallDate?: string;

  @IsOptional()
  @IsIn(['pending', 'active', 'inactive', 'disconnected', 'temporary_suspension'])
  connectionStatus?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsIn(['bpl', 'apl', 'government', 'commercial', 'institutional'])
  consumerCategory?: string;

  @IsOptional()
  @IsString()
  aadhaarLast4?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateConsumerServiceRequestDto {
  @IsIn(OM_CONSUMER_SERVICE_TYPES.map((t) => t.type) as unknown as string[])
  requestType: string;

  @IsOptional()
  details?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  newMeterNumber?: string;

  @IsOptional()
  @IsString()
  newMeterType?: string;

  @IsOptional()
  @IsString()
  newOwnerName?: string;

  @IsOptional()
  @IsString()
  newMobile?: string;
}
