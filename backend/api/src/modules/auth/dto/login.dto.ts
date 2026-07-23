import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@egip.local' })
  @IsEmail({ require_tld: false })
  email: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  @MinLength(6)
  password: string;

  /** Browser geolocation at sign-in (Audit Trail Location). */
  @ApiPropertyOptional({ example: 30.321794 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 78.003398 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** GPS accuracy radius in metres from browser Geolocation API. */
  @ApiPropertyOptional({ example: 94 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50000)
  accuracyMeters?: number;
}
