import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectContractDto {
  @ApiProperty({ description: '拒绝原因' })
  @IsString({ message: '拒绝原因必须是字符串' })
  @IsNotEmpty({ message: '拒绝原因不能为空' })
  reason: string;
}
