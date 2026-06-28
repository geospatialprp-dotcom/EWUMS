import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsNumber, IsOptional, IsString, Max, Min,
} from 'class-validator';

export class UpdateOmAssetDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  assetCode?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  typeCode?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  capacity?: string;

  @IsOptional()
  @IsString()
  installationDate?: string;

  @IsOptional()
  @IsString()
  warrantyDetails?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  designLifeYears?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  clearGis?: boolean;
}
