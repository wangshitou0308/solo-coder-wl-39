import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../../common/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePasswordDto {
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
