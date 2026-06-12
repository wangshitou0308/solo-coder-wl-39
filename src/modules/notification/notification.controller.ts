import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('通知管理')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '获取当前租户的通知列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码', type: Number })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量', type: Number })
  async getNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.notificationService.findByTenantId(
      user.tenantId,
      page || 1,
      pageSize || 20,
    );
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: '获取指定合同的通知历史' })
  @ApiParam({ name: 'contractId', description: '合同ID' })
  async getNotificationsByContract(
    @Param('contractId') contractId: string,
  ) {
    return this.notificationService.findByContractId(contractId);
  }
}
