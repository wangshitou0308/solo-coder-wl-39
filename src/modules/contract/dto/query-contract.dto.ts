import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ContractStatus, SigningMode, ContractTag } from '../../../common/enums';

export class QueryContractDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  initiatorId?: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsEnum(SigningMode)
  signingMode?: SigningMode;

  @IsOptional()
  @IsEnum(ContractTag)
  tag?: ContractTag;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
