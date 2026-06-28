import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import {
  OM_ARREAR_ACTIONS,
  OM_BILLING_CYCLES,
  OM_CONSUMER_CATEGORIES,
  OM_METER_CONDITIONS,
  OM_PAYMENT_MODES,
  OM_READING_METHODS,
} from '../constants/om-billing-catalog';

const CATEGORIES = OM_CONSUMER_CATEGORIES.map((c) => c.code);
const CYCLES = OM_BILLING_CYCLES.map((c) => c.code);
const READING_METHODS = OM_READING_METHODS.map((m) => m.code);
const METER_CONDITIONS = OM_METER_CONDITIONS.map((m) => m.code);
const PAYMENT_MODES = OM_PAYMENT_MODES.map((m) => m.code);

class TariffSlabDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fromKl: number;

  @Transform(({ value }) => (value === '' || value === null ? null : Number(value)))
  @IsOptional()
  @IsNumber()
  toKl?: number | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratePerKl: number;
}

export class CreateBillingTariffDto {
  @IsString()
  tariffName: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  consumerCategory?: string;

  @IsOptional()
  @IsIn(CYCLES)
  billingCycle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maintenanceCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  meterRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  latePenaltyPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reconnectionCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newConnectionCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxPct?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TariffSlabDto)
  slabs?: TariffSlabDto[];

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class RecordMeterReadingDto {
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

export class GenerateBillsDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;

  @IsOptional()
  @IsIn(CYCLES)
  billingCycle?: string;

  @IsOptional()
  @IsDateString()
  billingPeriodFrom?: string;

  @IsOptional()
  @IsDateString()
  billingPeriodTo?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  tariffId?: string;
}

const BILL_DELIVERY_CHANNELS = ['pdf', 'sms', 'whatsapp', 'email'] as const;
const ARREAR_ACTIONS = OM_ARREAR_ACTIONS.map((a) => a.code);

export class DeliverBillDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(BILL_DELIVERY_CHANNELS, { each: true })
  channels: Array<'pdf' | 'sms' | 'whatsapp' | 'email'>;
}

export class ArrearActionDto {
  @IsIn(ARREAR_ACTIONS)
  action: string;
}

export class RecordPaymentDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  billId?: string;

  @IsString()
  consumerId: string;

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

export class UpdateBillStatusDto {
  @IsIn(['approved', 'issued', 'waived'])
  status: 'approved' | 'issued' | 'waived';
}

export class LinkConsumerAccountDto {
  @IsOptional()
  @IsString()
  consumerName?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  consumerCategory?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  aadhaarLast4?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  tariffId?: string;

  @IsOptional()
  @IsString()
  meterNumber?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsIn(['pending', 'active', 'inactive', 'disconnected', 'temporary_suspension'])
  connectionStatus?: string;
}

export class CreateConsumerAccountDto {
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectId?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  projectCode?: string;

  @IsString()
  fhtcNumber: string;

  @IsOptional()
  @IsString()
  consumerName?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  consumerCategory?: string;

  @IsOptional()
  @IsString()
  aadhaarLast4?: string;

  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  meterNumber?: string;

  @IsOptional()
  @IsIn(['pending', 'active', 'inactive', 'disconnected', 'temporary_suspension'])
  connectionStatus?: string;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsString()
  tariffId?: string;
}
