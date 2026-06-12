import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { SigningService } from './signing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SignContractDto } from './dto/sign-contract.dto';
import { RejectContractDto } from './dto/reject-contract.dto';

@ApiTags('签署')
@Controller('signing')
export class SigningController {
  constructor(private readonly signingService: SigningService) {}

  private extractIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      'unknown'
    );
  }

  private extractUserAgent(req: Request): string {
    return req.headers['user-agent'] || 'unknown';
  }

  @Get('contract/:contractId/signers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取合同签署人列表' })
  async getSignersByContract(
    @CurrentUser() user: CurrentUserPayload,
    @Param('contractId') contractId: string,
  ) {
    return this.signingService.getSignersByContract(contractId, user.tenantId);
  }

  @Post('signer/:id/remind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '发送签署提醒' })
  async sendReminder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') signerId: string,
  ) {
    return this.signingService.sendReminder(signerId, user.tenantId);
  }

  @Get('public/verify/:token')
  @ApiOperation({ summary: '公开：验证签署token返回合同和签署人信息' })
  async verifySignToken(@Param('token') token: string) {
    return this.signingService.verifySignToken(token);
  }

  @Post('public/sign/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '公开：执行签署操作' })
  async signContract(
    @Param('token') token: string,
    @Body() dto: SignContractDto,
    @Req() req: Request,
  ) {
    const { signer } = await this.signingService.verifySignToken(token);
    const ipAddress = this.extractIp(req);
    const userAgent = this.extractUserAgent(req);
    return this.signingService.signContract(signer.id, dto, ipAddress, userAgent);
  }

  @Post('public/reject/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '公开：执行拒绝操作' })
  async rejectContract(
    @Param('token') token: string,
    @Body() dto: RejectContractDto,
    @Req() req: Request,
  ) {
    const { signer } = await this.signingService.verifySignToken(token);
    const ipAddress = this.extractIp(req);
    const userAgent = this.extractUserAgent(req);
    return this.signingService.rejectContract(signer.id, dto, ipAddress, userAgent);
  }
}
