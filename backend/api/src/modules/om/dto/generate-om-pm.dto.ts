import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class GenerateOmPmDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;
}
