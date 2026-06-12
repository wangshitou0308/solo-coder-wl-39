import { IsString, IsOptional, IsNumber, IsUrl, Min, IsBoolean } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  defaultSignDays?: number;

  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  archiveRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
