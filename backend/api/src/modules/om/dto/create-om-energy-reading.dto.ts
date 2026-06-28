import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOmEnergyReadingDto {
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
  assetId?: string;

  @IsString()
  readingDate: string;

  @IsOptional()
  @Type(() => Number)
  pumpRunningHours?: number;

  @IsOptional()
  @Type(() => Number)
  energyKwh?: number;

  @IsOptional()
  @Type(() => Number)
  energyCost?: number;

  @IsOptional()
  @Type(() => Number)
  waterPumpedKl?: number;

  @IsOptional()
  @Type(() => Number)
  powerFactor?: number;

  @IsOptional()
  @Type(() => Number)
  pumpEfficiencyPct?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
