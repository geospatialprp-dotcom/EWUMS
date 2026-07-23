import { IsArray, IsEmail, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

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

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsOptional()
  @IsUUID()
  divisionId?: string | null;
}
