import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitWorkflowDto {
  @IsString()
  definitionCode: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class ActOnTaskDto {
  @IsString()
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  comments?: string;
}
