import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DprActivityDto {
  @IsOptional() @IsString() activityCode?: string;
  @IsString() description: string;
  @IsString() unit: string;
  @IsNumber() @Min(0) quantityDone: number;
  @IsOptional() @IsUUID() boqItemId?: string;
  @IsOptional() @IsString() locationDetail?: string;
  @IsOptional() @IsString() component?: string;
  @IsOptional() @IsString() chainageFrom?: string;
  @IsOptional() @IsString() chainageTo?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() materialConsumption?: string;
  @IsOptional() @IsNumber() labourCount?: number;
  @IsOptional() @IsString() equipmentDetails?: string;
}

export class CreateDprDto {
  @IsString() dprNumber: string;
  @IsDateString() reportDate: string;
  @IsEnum(['gravity', 'pumping']) schemeType: 'gravity' | 'pumping';
  @IsOptional() @IsString() workLocation?: string;
  @IsOptional() @IsString() weather?: string;
  @IsOptional() @IsNumber() manpowerCount?: number;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsUUID() workPackageId?: string;
  @IsOptional() @IsString() contractorName?: string;
  @IsOptional() @IsString() supervisorName?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DprActivityDto)
  activities: DprActivityDto[];
}

export class MbEntryDto {
  @IsOptional() @IsUUID() boqItemId?: string;
  @IsOptional() @IsString() itemCode?: string;
  @IsString() description: string;
  @IsString() unit: string;
  @IsNumber() @Min(0) measuredQty: number;
  @IsNumber() @Min(0) rate: number;
  @IsOptional() @IsNumber() lengthM?: number;
  @IsOptional() @IsNumber() widthM?: number;
  @IsOptional() @IsNumber() heightM?: number;
  @IsOptional() @IsNumber() depthM?: number;
  @IsOptional() @IsNumber() nos?: number;
  @IsOptional() @IsString() chainageFrom?: string;
  @IsOptional() @IsString() chainageTo?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}

export class CreateMbDto {
  @IsString() mbNumber: string;
  @IsOptional() @IsUUID() dprId?: string;
  @IsOptional() @IsUUID() workPackageId?: string;
  @IsEnum(['gravity', 'pumping']) schemeType: 'gravity' | 'pumping';
  @IsDateString() measurementDate: string;
  @IsOptional() @IsString() siteLocation?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => MbEntryDto)
  entries: MbEntryDto[];
}

export class InvoiceLineDto {
  @IsOptional() @IsUUID() boqItemId?: string;
  @IsOptional() @IsUUID() mbEntryId?: string;
  @IsString() description: string;
  @IsString() unit: string;
  @IsNumber() @Min(0) quantity: number;
  @IsNumber() @Min(0) rate: number;
  @IsOptional() @IsNumber() previousQty?: number;
  @IsOptional() @IsNumber() currentQty?: number;
}

export class CreateInvoiceDto {
  @IsString() invoiceNumber: string;
  @IsOptional() @IsDateString() billingPeriodFrom?: string;
  @IsOptional() @IsDateString() billingPeriodTo?: string;
  @IsOptional() @IsEnum(['gravity', 'pumping', 'both']) schemeType?: 'gravity' | 'pumping' | 'both';
  @IsOptional() @IsEnum(['ra', 'final']) billType?: 'ra' | 'final';
  @IsOptional() @IsNumber() deductions?: number;
  @IsOptional() @IsNumber() gstAmount?: number;
  @IsOptional() @IsNumber() previousAmount?: number;
  @IsOptional() @IsString() departmentRef?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceLineDto)
  lineItems: InvoiceLineDto[];
}

export class CreateWorkPackageDto {
  @IsString() packageCode: string;
  @IsString() name: string;
  @IsString() component: string;
  @IsOptional() @IsEnum(['gravity', 'pumping', 'both']) schemeType?: 'gravity' | 'pumping' | 'both';
  @IsOptional() @IsString() contractorName?: string;
  @IsOptional() @IsString() chainageFrom?: string;
  @IsOptional() @IsString() chainageTo?: string;
  @IsOptional() @IsString() remarks?: string;
}

export class UpdateWorkPackageDto {
  @IsOptional() @IsString() contractorName?: string;
  @IsOptional() @IsUUID() contractorId?: string;
  @IsOptional() @IsEnum(['pending', 'approved', 'rejected']) gisAlignmentStatus?: 'pending' | 'approved' | 'rejected';
  @IsOptional() @IsEnum(['planned', 'in_progress', 'completed']) status?: 'planned' | 'in_progress' | 'completed';
  @IsOptional() @IsString() remarks?: string;
}

export class UpdateWorkPlanningDto {
  @IsOptional() @IsString() approvedDprUrl?: string;
  @IsOptional() @IsString() adminApprovalRef?: string;
  @IsOptional() @IsString() technicalSanctionRef?: string;
  @IsOptional() @IsString() boqUploadUrl?: string;
  @IsOptional() @IsString() l1ContractorBoqUploadUrl?: string;
  @IsOptional() @IsString() contractorPoUploadUrl?: string;
  @IsOptional() @IsString() drawingUploadUrl?: string;
  @IsOptional() @IsBoolean() gisAlignmentApproved?: boolean;
  @IsOptional() @IsEnum(['draft', 'approved']) status?: 'draft' | 'approved';
}

export class ImportBoqItemDto {
  @IsString() itemCode: string;
  @IsString() description: string;
  @IsString() unit: string;
  @Type(() => Number) @IsNumber() @Min(0) contractQty: number;
  @Type(() => Number) @IsNumber() @Min(0) rate: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) contractAmount?: number;
  @IsEnum(['gravity', 'pumping']) schemeType: 'gravity' | 'pumping';
  @IsOptional() @IsString() component?: string;
  @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
}

export class ImportBoqDto {
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsBoolean() replaceExisting?: boolean;
  @IsOptional() @IsEnum(['government', 'l1_contractor']) boqSource?: 'government' | 'l1_contractor';
  @IsArray() @ValidateNested({ each: true }) @Type(() => ImportBoqItemDto)
  items: ImportBoqItemDto[];
}

export class CreateRaBillDto {
  @IsString() raNumber: string;
  @IsOptional() @IsDateString() billingPeriodFrom?: string;
  @IsOptional() @IsDateString() billingPeriodTo?: string;
  @IsOptional() @IsString() schemeType?: string;
  @IsOptional() @IsNumber() recoveries?: number;
  @IsOptional() @IsNumber() gstAmount?: number;
  @IsOptional() @IsString() remarks?: string;
}

export class UpdateCompletionVerificationDto {
  @IsOptional() @IsBoolean() asBuiltVerified?: boolean;
  @IsOptional() @IsBoolean() reservoirCommissioned?: boolean;
  @IsOptional() @IsBoolean() pumpingCommissioned?: boolean;
}

export class GenerateFinalBillDto {
  @IsString() invoiceNumber: string;
  @IsOptional() @IsNumber() recoveries?: number;
  @IsOptional() @IsString() remarks?: string;
}

export class CreateConstructionAssetDto {
  @IsString() assetCode: string;
  @IsString() assetType: string;
  @IsOptional() @IsString() component?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() chainage?: string;
  @IsOptional() @IsDateString() installationDate?: string;
  @IsOptional() @IsString() contractorName?: string;
  @IsOptional() @IsString() mbReference?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsIn(['planned', 'installed', 'commissioned'])
  status?: 'planned' | 'installed' | 'commissioned';
}

export class UpdateConstructionAssetDto {
  @IsOptional() @IsString() assetCode?: string;
  @IsOptional() @IsString() assetType?: string;
  @IsOptional() @IsString() component?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() chainage?: string;
  @IsOptional() @IsDateString() installationDate?: string;
  @IsOptional() @IsString() contractorName?: string;
  @IsOptional() @IsString() mbReference?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsIn(['planned', 'installed', 'commissioned'])
  status?: 'planned' | 'installed' | 'commissioned';
}

export class UploadDocumentDto {
  @IsEnum(['dpr', 'measurement_book', 'invoice', 'ra_bill', 'work_planning', 'completion', 'construction_asset'])
  resourceType: 'dpr' | 'measurement_book' | 'invoice' | 'ra_bill' | 'work_planning' | 'completion' | 'construction_asset';
  @IsUUID() resourceId: string;
  @IsString() docType: string;
  @IsString() fileName: string;
  @IsString() fileUrl: string;
}

export class WorkflowActionDto {
  @IsEnum(['approve', 'reject']) action: 'approve' | 'reject';
  @IsOptional() @IsString() comments?: string;
}
