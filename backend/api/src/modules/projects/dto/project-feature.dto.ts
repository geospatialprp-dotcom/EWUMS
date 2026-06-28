import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator';

export class CreateProjectFeatureDto {
  @ApiPropertyOptional({ description: 'GeoJSON geometry matching the feature class type' })
  @IsOptional()
  @IsObject()
  geometry?: object;

  @ApiPropertyOptional({ description: 'Attribute values keyed by field name' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateProjectFeatureDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  geometry?: object;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class ImportProjectFeatureItemDto {
  @ApiProperty({ description: 'GeoJSON geometry matching the feature class type' })
  @IsObject()
  geometry: object;

  @ApiPropertyOptional({ description: 'Attribute values keyed by field name' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class ImportProjectFeaturesDto {
  @ApiProperty({ type: [ImportProjectFeatureItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportProjectFeatureItemDto)
  features: ImportProjectFeatureItemDto[];
}
