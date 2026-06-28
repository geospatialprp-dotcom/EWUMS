import { Transform } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateHandoverDto {
  @IsOptional()
  @IsString()
  schemeName?: string;

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
  omAgencyType?: string;

  @IsOptional()
  @IsString()
  omAgencyName?: string;

  @IsOptional()
  @IsBoolean()
  completionVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  commissioningVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  asBuiltVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  gisMappingVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  assetRegisterVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  fhtcVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  omManualVerified?: boolean;

  @IsOptional()
  @IsObject()
  responsibilityMatrix?: Record<string, unknown>;
}
