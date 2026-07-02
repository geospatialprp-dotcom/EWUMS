import { IsOptional, IsString } from 'class-validator';

export class RequestProjectDeletionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DecideProjectDeletionDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
