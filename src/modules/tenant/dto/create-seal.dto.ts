import { IsString, IsOptional, IsUrl, IsNotEmpty } from 'class-validator';

export class CreateSealDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl()
  @IsNotEmpty()
  imageUrl: string;

  @IsOptional()
  @IsString()
  sealType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  active?: boolean;
}
