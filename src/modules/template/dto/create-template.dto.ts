import { IsBoolean, IsEnum, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateCategory } from '../../../common/enums';

export class TemplateVariableDto {
  @IsString()
  name: string;

  @IsString()
  label: string;

  @IsString()
  type: string;

  @IsBoolean()
  required: boolean;

  @IsOptional()
  defaultValue?: any;
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory = TemplateCategory.CUSTOM;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables?: TemplateVariableDto[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean = true;
}
