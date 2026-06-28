import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateAccountingAdjustmentDto {
  @IsUUID()
  consumerId: string;

  @IsOptional()
  @IsUUID()
  billId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  entryDate: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsIn(['write_off', 'correction', 'waiver'])
  adjustmentType?: string;
}
