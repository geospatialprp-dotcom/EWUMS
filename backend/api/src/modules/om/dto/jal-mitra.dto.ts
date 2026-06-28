import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JalMitraLang } from '../jal-mitra/jal-mitra-i18n';

export class StartJalMitraSessionDto {
  @IsOptional()
  @IsString()
  @IsIn(['web_portal', 'mobile_app', 'whatsapp', 'voice', 'call_centre'])
  channel?: string;

  @IsOptional()
  @IsString()
  @IsIn(['en', 'hi', 'garhwali', 'kumaoni'])
  language?: JalMitraLang;
}

export class JalMitraMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  quickActionId?: string;

  /** Consumer's selected chat language — keeps Garhwali/Kumaoni replies. */
  @IsOptional()
  @IsString()
  @IsIn(['en', 'hi', 'garhwali', 'kumaoni'])
  language?: JalMitraLang;
}

export class JalMitraVerifyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  fhtcNumber: string;

  @IsString()
  @MinLength(10)
  @MaxLength(15)
  mobile: string;
}

export class JalMitraLanguageDto {
  @IsString()
  @IsIn(['en', 'hi', 'garhwali', 'kumaoni'])
  language: JalMitraLang;
}

export class JalMitraEscalateDto {
  @IsOptional()
  @IsString()
  @IsIn(['consumer_service', 'je', 'ae', 'ee', 'call_centre'])
  targetRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class JalMitraOtpRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  fhtcNumber: string;

  @IsString()
  @MinLength(10)
  @MaxLength(15)
  mobile: string;
}

export class JalMitraOtpVerifyDto extends JalMitraOtpRequestDto {
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  otp: string;
}
