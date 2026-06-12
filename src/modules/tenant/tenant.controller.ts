import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  async getCurrentTenant(@CurrentUser() user: CurrentUserPayload) {
    return this.tenantService.findById(user.tenantId);
  }

  @Put()
  @Roles(UserRole.ADMIN)
  async updateTenant(
    @CurrentUser() user: CurrentUserPayload,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantService.update(user.tenantId, updateTenantDto, user.userId);
  }
}
