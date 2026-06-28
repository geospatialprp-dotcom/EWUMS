import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsUuidLike } from '../../../common/decorators/uuid-like.decorator';
import { OrthomosaicConfigDto } from './orthomosaic-config.dto';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  projectCode?: string;

  @IsOptional()
  @IsUuidLike()
  divisionId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  spent?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrthomosaicConfigDto)
  orthomosaicConfig?: OrthomosaicConfigDto | null;
}
