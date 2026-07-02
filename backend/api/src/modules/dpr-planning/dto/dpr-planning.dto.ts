import { Type } from 'class-transformer';
import {
  IsIn, IsNumber, IsOptional, IsString, IsUUID, IsObject,
} from 'class-validator';
import { DPR_ADVANCE_ACTIONS } from '../constants/dpr-planning.constants';

export class CreateDprProposalDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsUUID()
  divisionId?: string;

  @IsOptional()
  @IsString()
  schemeJustification?: string;

  @IsOptional()
  @Type(() => Number)
  preliminaryEstimate?: number;

  @IsOptional()
  @IsString()
  fundingSource?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsObject()
  gisBoundary?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;
}

export class UploadDprDocumentDto {
  @IsString()
  documentType: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateDprProposalDto {
  @IsOptional()
  @IsString()
  schemeJustification?: string;

  @IsOptional()
  @Type(() => Number)
  preliminaryEstimate?: number;

  @IsOptional()
  @IsString()
  fundingSource?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @IsOptional()
  @IsObject()
  gisBoundary?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;
}

export class SubmitDprProposalDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class SubmitDprToHqDto {
  @IsOptional()
  @IsString()
  comments?: string;

  /** excel_auto = require BOQ Excel audit; pdf_only = Complete DPR PDF + basic PDF checks only */
  @IsOptional()
  @IsIn(['excel_auto', 'pdf_only'])
  validationMode?: 'excel_auto' | 'pdf_only';
}

export class TacValidationModeDto {
  @IsIn(['excel_auto', 'pdf_only'])
  validationMode: 'excel_auto' | 'pdf_only';
}

export class Stage3HqRemarksDto {
  @IsString()
  remarks: string;
}

export class ResubmitRevisedDprDto {
  @IsOptional()
  @IsString()
  comments?: string;

  /** How the DPR team addressed TAC observations */
  @IsOptional()
  @IsString()
  observationResponse?: string;
}

export class HqReviewDprProposalDto {
  @IsIn(['approve', 'return', 'return_to_division', 'reject'])
  action: 'approve' | 'return' | 'return_to_division' | 'reject';

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  needAssessment?: boolean;

  @IsOptional()
  budgetAvailability?: boolean;

  @IsOptional()
  schemePriority?: boolean;

  @IsOptional()
  fundingSource?: boolean;
}

export class TacReviewDprProposalDto {
  @IsIn(['approve', 'suggest_corrections', 'request_info', 'return_revision'])
  action: 'approve' | 'suggest_corrections' | 'request_info' | 'return_revision';

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  complianceNotes?: string;

  @IsOptional()
  technicalFeasibility?: boolean;

  @IsOptional()
  designStandards?: boolean;

  @IsOptional()
  hydraulicCalculations?: boolean;

  @IsOptional()
  costEstimates?: boolean;

  @IsOptional()
  boqQuantities?: boolean;

  @IsOptional()
  drawingsLayouts?: boolean;
}

export class ForwardToTacDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class ForwardToSecretariatDto {
  @IsString()
  secretariatRef: string;

  @IsString()
  receivingAuthority: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  fundingRequirementNotes?: string;
}

export class BeginTacRound2ExaminationDto {
  @IsOptional()
  @IsString()
  committeeRef?: string;

  @IsOptional()
  @IsString()
  examiningAuthority?: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class TacRound2ReviewDto {
  @IsIn(['approve', 'suggest_corrections', 'request_info', 'return_revision'])
  action: 'approve' | 'suggest_corrections' | 'request_info' | 'return_revision';

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  complianceNotes?: string;

  @IsOptional()
  technicalExamination?: boolean;

  @IsOptional()
  financialExamination?: boolean;

  @IsOptional()
  costEstimateScrutiny?: boolean;

  @IsOptional()
  budgetFundProvisioning?: boolean;

  @IsOptional()
  boqFinancialCompliance?: boolean;

  @IsOptional()
  designStandardsCompliance?: boolean;

  @IsOptional()
  envSocialClearances?: boolean;

  @IsOptional()
  fundingRequirements?: boolean;
}

export class SubmitRound2ComplianceDto {
  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  observationResponse?: string;
}

export class AssignRound2ComplianceToEeDto {
  @IsOptional()
  @IsString()
  message?: string;
}

export class ReviewRound2ComplianceAdminDto {
  @IsIn(['forward_secretariat', 'return_to_ee'])
  action: 'forward_secretariat' | 'return_to_ee';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class RecordAdministrativeSanctionDto {
  @IsString()
  administrativeApprovalNo: string;

  @IsString()
  expenditureSanctionNo: string;

  @IsNumber()
  @Type(() => Number)
  sanctionedAmount: number;

  @IsString()
  budgetHead: string;

  @IsString()
  sanctionDate: string;

  @IsString()
  fundingReleaseRef: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

/** Super Admin authorizes Division EE to download sanctioned package and begin tender preparation. */
export class AuthorizeTenderPrepDto {
  @IsOptional()
  @IsString()
  divisionInstructions?: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

/** @deprecated Use AuthorizeTenderPrepDto — kept for route compatibility */
export class InitiateTenderPreparationDto extends AuthorizeTenderPrepDto {}

export class BeginEeTenderPrepDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class BeginTenderProcessingDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class TenderApprovalReviewDto {
  @IsIn(['verify', 'approve', 'return'])
  action: 'verify' | 'approve' | 'return';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class PublishTenderDto {
  @IsOptional()
  @IsString()
  nitRef?: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class AdvanceDprProposalDto {
  @IsIn(DPR_ADVANCE_ACTIONS as unknown as string[])
  action: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  secretariatRef?: string;

  @IsOptional()
  @IsString()
  administrativeApprovalNo?: string;

  @IsOptional()
  @IsString()
  expenditureSanctionNo?: string;

  @IsOptional()
  @Type(() => Number)
  sanctionedAmount?: number;

  @IsOptional()
  @IsString()
  budgetHead?: string;

  @IsOptional()
  @IsString()
  sanctionDate?: string;

  @IsOptional()
  @IsString()
  fundingReleaseRef?: string;

  @IsOptional()
  @IsString()
  nitRef?: string;

  @IsOptional()
  @IsString()
  taskOrderRef?: string;
}
