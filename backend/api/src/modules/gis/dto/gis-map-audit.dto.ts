import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class GisMapAuditDto {
  @IsString()
  action: string;

  @IsOptional()
  @IsUUID()
  layerId?: string;

  @IsOptional()
  @IsString()
  layerName?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}
