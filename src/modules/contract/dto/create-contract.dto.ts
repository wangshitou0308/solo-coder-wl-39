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

export class CreateSignerDto {
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

export class CreateContractDto {
  @IsString()
  title: string;

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
  signingMode?: SigningMode = SigningMode.SEQUENTIAL;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSignerDto)
  signers: CreateSignerDto[];

  @IsOptional()
  @IsDateString()
  signDeadline?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ContractTag, { each: true })
  tags?: ContractTag[];
}
