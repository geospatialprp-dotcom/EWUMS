import { IsOptional, IsString } from 'class-validator';

export class CompleteOmPmDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
