import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString({ message: '租户名称必须是字符串' })
  @IsNotEmpty({ message: '租户名称不能为空' })
  @MaxLength(100, { message: '租户名称长度不能超过100个字符' })
  tenantName: string;

  @IsString({ message: '租户编码必须是字符串' })
  @IsNotEmpty({ message: '租户编码不能为空' })
  @Matches(/^[a-zA-Z0-9_-]{3,50}$/, { message: '租户编码只能包含字母、数字、下划线和短横线，长度3-50个字符' })
  tenantCode: string;

  @IsString({ message: '用户姓名必须是字符串' })
  @IsNotEmpty({ message: '用户姓名不能为空' })
  @MaxLength(50, { message: '用户姓名长度不能超过50个字符' })
  name: string;

  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email: string;

  @IsOptional()
  @IsString({ message: '手机号必须是字符串' })
  phone?: string;

  @IsString({ message: '密码必须是字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度不能少于6位' })
  @MaxLength(50, { message: '密码长度不能超过50个字符' })
  password: string;
}
