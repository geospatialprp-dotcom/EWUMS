import { Transform, Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { VALID_WQ_SAMPLE_POINTS } from '../constants/om-wq-catalog';

export class CreateOmWqTestDto {
  @IsIn(VALID_WQ_SAMPLE_POINTS as unknown as string[])
  samplePoint: string;

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
  sampleDate?: string;

  @IsOptional()
  @IsString()
  sampleLabel?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  resultNotes?: string;
}

export class AdvanceOmWqTestDto {
  @IsOptional()
  @IsString()
  labName?: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  resultNotes?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  correctiveAction?: string;
}
