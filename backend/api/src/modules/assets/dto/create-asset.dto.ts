import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ example: 'PL-002' })
  @IsString()
  assetCode: string;

  @ApiProperty()
  @IsUUID()
  assetTypeId: string;

  @ApiProperty({ example: 'Secondary Distribution Line' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'GeoJSON geometry object' })
  @IsOptional()
  @IsObject()
  geometry?: object;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
