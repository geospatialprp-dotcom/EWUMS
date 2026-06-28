import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class SpatialQueryDto {
  @ApiProperty({ enum: ['buffer', 'intersect', 'within'] })
  @IsString()
  operation: 'buffer' | 'intersect' | 'within';

  @ApiProperty({ description: 'GeoJSON geometry' })
  @IsObject()
  geometry: object;

  @ApiPropertyOptional({ description: 'Buffer distance in meters', example: 1000 })
  @IsOptional()
  @IsNumber()
  distance?: number;

  @ApiPropertyOptional({ description: 'Filter by asset type code' })
  @IsOptional()
  @IsString()
  assetType?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;
}
