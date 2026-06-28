import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, ValidateNested,
} from 'class-validator';

export class AttributeFieldDto {
  @ApiProperty({ example: 'pipe_diameter' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'Field name must be lowercase snake_case' })
  name: string;

  @ApiProperty({ example: 'Pipe Diameter (mm)' })
  @IsString()
  label: string;

  @ApiProperty({ enum: ['text', 'number', 'integer', 'boolean', 'date', 'select', 'image'] })
  @IsIn(['text', 'number', 'integer', 'boolean', 'date', 'select', 'image'])
  type: 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'select' | 'image';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CreateFeatureClassDto {
  @ApiProperty({ example: 'survey_points' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  code: string;

  @ApiProperty({ example: 'Survey Points' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['Point', 'LineString', 'Polygon', 'Any'] })
  @IsIn(['Point', 'LineString', 'Polygon', 'Any'])
  geometryType: 'Point' | 'LineString' | 'Polygon' | 'Any';

  @ApiProperty({ type: [AttributeFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeFieldDto)
  attributeSchema: AttributeFieldDto[];

  @ApiPropertyOptional()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateFeatureClassDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: ['Any'],
    description: 'Only widening to "Any" (mixed) is allowed, so existing features stay valid.',
  })
  @IsOptional()
  @IsIn(['Any'])
  geometryType?: 'Any';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [AttributeFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeFieldDto)
  attributeSchema?: AttributeFieldDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
