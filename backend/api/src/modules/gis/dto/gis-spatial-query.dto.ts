import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsObject, IsOptional, IsUUID, Min } from 'class-validator';

export enum GisSpatialOperation {
  INTERSECT = 'intersect',
  WITHIN = 'within',
  CONTAINS = 'contains',
  BUFFER = 'buffer',
}

export class GisSpatialQueryDto {
  @ApiProperty({ enum: GisSpatialOperation })
  @IsEnum(GisSpatialOperation)
  operation: GisSpatialOperation;

  @ApiProperty({ description: 'GeoJSON geometry for the query area (Point, LineString, or Polygon)' })
  @IsObject()
  geometry: object;

  @ApiProperty({ description: 'Map layer id (project feature class layer) to query' })
  @IsUUID()
  layerId: string;

  @ApiPropertyOptional({ description: 'Buffer distance in meters (required for buffer operation)', example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  distance?: number;
}
