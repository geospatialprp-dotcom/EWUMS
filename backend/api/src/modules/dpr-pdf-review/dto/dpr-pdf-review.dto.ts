import {
  IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength,
} from 'class-validator';
import { DPR_PDF_ANNOTATION_TYPES } from '../constants/dpr-pdf-review.constants';

export class DocumentIdQueryDto {
  @IsUUID()
  documentId: string;
}

export class CreateDprPdfAnnotationDto {
  @IsUUID()
  documentId: string;

  @IsInt()
  @Min(1)
  pageNumber: number;

  @IsIn([...DPR_PDF_ANNOTATION_TYPES])
  annotationType: string;

  @IsObject()
  geometry: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
}

export class UpdateDprPdfAnnotationDto {
  @IsOptional()
  @IsObject()
  geometry?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
}

export class CreateDprPdfCommentDto {
  @IsUUID()
  documentId: string;

  @IsOptional()
  @IsUUID()
  annotationId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNumber?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateDprPdfCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body: string;
}
