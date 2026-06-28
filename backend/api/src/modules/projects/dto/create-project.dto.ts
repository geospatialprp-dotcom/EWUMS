import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsUuidLike } from '../../../common/decorators/uuid-like.decorator';
import { PROJECT_CODE_PATTERN } from '../utils/project-code.util';
import { OrthomosaicConfigDto } from './orthomosaic-config.dto';
export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(PROJECT_CODE_PATTERN, {
    message: 'projectCode must follow PRJ-INITIALS-2026-27 (letters from project name + financial year)',
  })
  projectCode?: string;

  @IsOptional()
  @IsUuidLike()
  divisionId?: string;

  @IsString()
  @IsNotEmpty()
  @IsUuidLike()
  dprProposalId: string;

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
