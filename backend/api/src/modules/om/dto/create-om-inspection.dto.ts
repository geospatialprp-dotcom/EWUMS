import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID,
} from 'class-validator';

export class CreateOmInspectionDto {
  @IsIn(['daily', 'weekly', 'monthly'])
  inspectionType: string;

  @IsString()
  performedByRole: string;

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

  @IsOptional()
  @IsString()
  inspectionDate?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsObject()
  checklist: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  photos?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  notes?: string;
}
