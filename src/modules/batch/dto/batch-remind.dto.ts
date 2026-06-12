import { IsArray, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class BatchRemindDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  contractIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  signerIds?: string[];
}
