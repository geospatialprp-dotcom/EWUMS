import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, ValidateNested,
} from 'class-validator';
import { VALID_BREAKDOWN_COMPLAINTS } from '../constants/om-breakdown-catalog';

class MaterialUsedDto {
  @IsString()
  item: string;

  @IsString()
  quantity: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

class LabourUsedDto {
  @IsString()
  role: string;

  @Type(() => Number)
  @IsNumber()
  hours: number;

  @IsOptional()
  @IsString()
  name?: string;
}

class PhotoMetaDto {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  url?: string;
}

export class CreateBreakdownTicketDto {
  @IsString()
  title: string;

  @IsIn(VALID_BREAKDOWN_COMPLAINTS as unknown as string[])
  category: string;

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
  assetId?: string;

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

export class AdvanceBreakdownTicketDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsUUID('loose')
  assignedTo?: string;

  @IsOptional()
  @IsString()
  inspectionNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoMetaDto)
  beforePhotos?: PhotoMetaDto[];

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  repairDetails?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialUsedDto)
  materialsUsed?: MaterialUsedDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabourUsedDto)
  labourUsed?: LabourUsedDto[];

  @IsOptional()
  @IsString()
  verificationNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoMetaDto)
  afterPhotos?: PhotoMetaDto[];
}
