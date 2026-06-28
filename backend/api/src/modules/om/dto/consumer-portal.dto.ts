import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { VALID_COMPLAINT_TYPES } from '../constants/om-complaint-catalog';

export class ConsumerPortalLoginDto {
  @IsString()
  fhtcNumber: string;

  @IsString()
  mobile: string;
}

export class ConsumerPortalOtpRequestDto {
  @IsString()
  fhtcNumber: string;

  @IsString()
  mobile: string;
}

export class ConsumerPortalOtpVerifyDto {
  @IsString()
  fhtcNumber: string;

  @IsString()
  mobile: string;

  @IsString()
  otp: string;
}

export class ConsumerPortalComplaintDto {
  @IsIn(VALID_COMPLAINT_TYPES as unknown as string[])
  complaintType: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;
}

export class ConsumerPortalNewConnectionDto {
  @IsString()
  fhtcNumber: string;

  @IsString()
  mobile: string;

  @IsOptional()
  @IsString()
  consumerName?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsIn(['bpl', 'apl', 'government', 'commercial', 'institutional'])
  consumerCategory?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;
}

export class ConsumerPortalTrackApplicationDto {
  @IsString()
  requestNo: string;

  @IsOptional()
  @IsString()
  fhtcNumber?: string;

  @IsOptional()
  @IsString()
  mobile?: string;
}

export class ConsumerPortalUpdateMobileDto {
  @IsString()
  mobile: string;
}
