import { IsArray, IsBooleanString, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ContractStatus } from '../../../common/enums';

export class QueryArchiveDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  initiatorId?: string;

  @IsOptional()
  @IsString()
  signerName?: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  contractStatus?: ContractStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBooleanString()
  isVoided?: string;
}
