import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { OM_SCADA_SITES } from '../constants/om-scada-catalog';

const VALID_CATEGORIES = OM_SCADA_SITES.map((s) => s.category);
const VALID_METRICS = OM_SCADA_SITES.flatMap((s) => s.metrics.map((m) => m.key));

export class IngestScadaReadingDto {
  @IsIn(VALID_CATEGORIES as unknown as string[])
  siteCategory: string;

  @IsIn(VALID_METRICS as unknown as string[])
  metricKey: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @Type(() => Number)
  valueNumeric?: number;

  @IsOptional()
  @IsString()
  valueText?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn(['scada', 'iot', 'manual'])
  source?: string;

  @IsOptional()
  @IsString()
  recordedAt?: string;
}

export class IngestScadaBatchDto {
  readings: IngestScadaReadingDto[];
}
