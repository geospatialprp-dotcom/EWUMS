import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { OM_METER_CONDITIONS, OM_PAYMENT_MODES, OM_READING_METHODS } from '../constants/om-billing-catalog';

const READING_METHODS = OM_READING_METHODS.map((m) => m.code);
const METER_CONDITIONS = OM_METER_CONDITIONS.map((m) => m.code);
const PAYMENT_MODES = OM_PAYMENT_MODES.map((m) => m.code);

export class MobileMeterReadingDto {
  @IsDateString()
  readingDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentReading: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  previousReading?: number;

  @IsOptional()
  @IsIn(READING_METHODS)
  readingMethod?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsIn(METER_CONDITIONS)
  meterCondition?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  consumerSignature?: string;

  @IsOptional()
  @IsIn(['signature', 'thumb_impression'])
  consumerConsentType?: 'signature' | 'thumb_impression';

  @IsOptional()
  @IsString()
  offlineId?: string;

  @IsOptional()
  @IsString()
  capturedAt?: string;
}

export class MobilePaymentDto {
  @IsUUID()
  consumerId: string;

  @IsOptional()
  @IsUUID()
  billId?: string;

  @IsDateString()
  paymentDate: string;

  @IsIn(PAYMENT_MODES)
  paymentMode: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  transactionRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  consumerSignature?: string;

  @IsOptional()
  @IsIn(['signature', 'thumb_impression'])
  consumerConsentType?: 'signature' | 'thumb_impression';

  @IsOptional()
  @IsString()
  offlineId?: string;

  @IsOptional()
  @IsString()
  capturedAt?: string;
}

export class CreatePaymentGatewayOrderDto {
  @IsUUID()
  consumerId: string;

  @IsOptional()
  @IsUUID()
  billId?: string;

  @IsIn(PAYMENT_MODES)
  paymentMode: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  consumerLabel?: string;
}

export class VerifyPaymentGatewayDto extends MobilePaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;
}

export class MobileSyncItemDto {
  @IsString()
  offlineId: string;

  @IsIn(['meter_reading', 'payment'])
  type: 'meter_reading' | 'payment';

  @IsUUID()
  consumerId: string;

  @IsDateString()
  capturedAt: string;

  @IsObject()
  payload: Record<string, unknown>;
}

export class MobileSyncBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  items: MobileSyncItemDto[];
}
