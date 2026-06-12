import { IsArray, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class BatchDownloadDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  archiveIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  contractIds?: string[];
}
