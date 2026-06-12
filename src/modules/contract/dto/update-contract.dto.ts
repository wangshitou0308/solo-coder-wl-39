import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SigningMode, ContractTag } from '../../../common/enums';

export class UpdateSignerDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  signOrder?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  pdfFileUrl?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  variables?: Record<string, any>;

  @IsOptional()
  @IsEnum(SigningMode)
  signingMode?: SigningMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSignerDto)
  signers?: UpdateSignerDto[];

  @IsOptional()
  @IsDateString()
  signDeadline?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ContractTag, { each: true })
  tags?: ContractTag[];
}
