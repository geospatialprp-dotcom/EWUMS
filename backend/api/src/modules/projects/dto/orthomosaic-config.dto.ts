import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class OrthomosaicConfigDto {
  @IsOptional()
  @IsIn(['xyz', 'file'])
  sourceType?: 'xyz' | 'file';

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(2000)
  tileUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(2000)
  mosaicUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  attribution?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  maxZoom?: number;
}
