import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SignMethod } from '../../../common/enums';
import { ApiProperty } from '@nestjs/swagger';

export class SignContractDto {
  @ApiProperty({ description: '签署方式', enum: SignMethod })
  @IsEnum(SignMethod, { message: '无效的签署方式' })
  @IsNotEmpty({ message: '签署方式不能为空' })
  signMethod: SignMethod;

  @ApiProperty({ description: '手写签名URL', required: false })
  @IsOptional()
  @IsString({ message: '签名URL必须是字符串' })
  signatureUrl?: string;

  @ApiProperty({ description: '印章ID', required: false })
  @IsOptional()
  @IsString({ message: '印章ID必须是字符串' })
  sealId?: string;
}
