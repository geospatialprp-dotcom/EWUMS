import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsUuidLike } from '../../../common/decorators/uuid-like.decorator';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === '' || value === null) return undefined;
  return value;
}

export class LinkLaCaseProjectDto {
  @ApiProperty()
  @IsUuidLike()
  projectId: string;
}

export class CreateLaCaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUuidLike()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUuidLike()
  dprProposalId?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ default: 'gravity' })
  @IsOptional()
  @IsString()
  schemeType?: string;
}

export class TraceAlignmentDto {
  @ApiPropertyOptional({ description: 'ROW buffer width in meters', default: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  rowWidthM?: number;

  @ApiPropertyOptional({ description: 'Limit to specific feature class code' })
  @IsOptional()
  @IsString()
  featureClassCode?: string;
}

export class IdentifyParcelsDto {
  @ApiPropertyOptional({ default: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  rowWidthM?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parcelFeatureClassCode?: string;
}

export class AdvanceLaCaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateLaParcelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  village?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  khasraNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landUse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acquisitionMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  circleRatePerSqm?: number;
}

export class UpdateLaClearanceDto {
  @ApiProperty()
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class LonLatPairDto {
  @ApiProperty({ example: 79.0193, description: 'Longitude (WGS84)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @ApiProperty({ example: 30.0668, description: 'Latitude (WGS84)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;
}

export class AutoRouteDto {
  @ApiProperty({ type: LonLatPairDto })
  @ValidateNested()
  @Type(() => LonLatPairDto)
  start: LonLatPairDto;

  @ApiProperty({ type: LonLatPairDto })
  @ValidateNested()
  @Type(() => LonLatPairDto)
  end: LonLatPairDto;

  @ApiPropertyOptional({ default: 6, description: 'ROW width used when tracing after save' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  rowWidthM?: number;

  @ApiPropertyOptional({ default: 50, description: 'Routing grid cell size in meters' })
  @IsOptional()
  @IsNumber()
  @Min(20)
  gridCellSizeM?: number;

  @ApiPropertyOptional({ description: 'Criteria weights 0 (ignore) to 2 (strict)' })
  @IsOptional()
  weights?: Record<string, number>;

  @ApiPropertyOptional({ default: true, description: 'Save route to la_alignment and trace alignment' })
  @IsOptional()
  @IsBoolean()
  saveAndTrace?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  featureClassCode?: string;

  @ApiPropertyOptional({ description: 'Pre-computed route geometry to save instead of generating' })
  @IsOptional()
  geometry?: { type: 'LineString'; coordinates: [number, number][] };

  @ApiPropertyOptional({ description: 'Imported pipeline network (GeoJSON FeatureCollection)' })
  @IsOptional()
  importedNetwork?: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties?: Record<string, unknown>;
      geometry?: { type: string; coordinates: unknown };
    }>;
  };

  @ApiPropertyOptional({ description: 'Snap start/end to nearest points on imported network' })
  @IsOptional()
  @IsBoolean()
  snapToImportedNetwork?: boolean;

  @ApiPropertyOptional({ description: 'Use imported line geometry as routing corridor constraint' })
  @IsOptional()
  @IsBoolean()
  useImportedAsCorridor?: boolean;
}
