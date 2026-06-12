import { IsOptional, IsString } from 'class-validator';

export class VoidContractDto {
  @IsString()
  reason: string;
}

export class ConfirmVoidDto {
  @IsOptional()
  @IsString()
  remark?: string;
}
