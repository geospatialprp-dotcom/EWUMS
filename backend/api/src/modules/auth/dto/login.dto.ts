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

  /** Optional browser geolocation captured at sign-in for Audit Trail. */
  @ApiPropertyOptional({ example: 30.3165 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 78.0322 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
