import { Transform, Type } from 'class-transformer';
import {
  IsNumber, IsObject, IsOptional, IsString, Max, Min,
} from 'class-validator';

export class RegisterOmAssetDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  assetCode?: string;

  @IsString()
  typeCode: string;

  @IsString()
  name: string;

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
  @IsString()
  handoverId?: string;

  @IsOptional()
  @IsString()
  omAgency?: string;

  @IsOptional()
  @IsString()
  installationDate?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  capacity?: string;

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

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class ImportConstructionAssetsDto {
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
  @IsString()
  handoverId?: string;
}
