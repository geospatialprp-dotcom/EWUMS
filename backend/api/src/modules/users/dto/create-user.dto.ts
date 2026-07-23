import { IsArray, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsArray()
  @IsString({ each: true })
  roleIds: string[];

  /** Field division assignment (required for division-scoped staff). */
  @IsOptional()
  @IsUUID()
  divisionId?: string;
}
