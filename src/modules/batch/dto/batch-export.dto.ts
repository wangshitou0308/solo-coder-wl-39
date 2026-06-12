import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ContractStatus, ContractTag } from '../../../common/enums';

export class BatchExportDto {
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsString()
  initiatorId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ContractTag, { each: true })
  tags?: ContractTag[];
}
