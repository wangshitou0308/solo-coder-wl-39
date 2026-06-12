import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SealService } from './seal.service';
import { CreateSealDto } from './dto/create-seal.dto';
import { UpdateSealDto } from './dto/update-seal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

@Controller('tenant/seals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SealController {
  constructor(private readonly sealService: SealService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createSealDto: CreateSealDto,
  ) {
    return this.sealService.create(user.tenantId, createSealDto, user.userId);
  }

  @Get()
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.sealService.findAll(user.tenantId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.sealService.findOne(id, user.tenantId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateSealDto: UpdateSealDto,
  ) {
    return this.sealService.update(id, user.tenantId, updateSealDto, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.sealService.remove(id, user.tenantId);
    return { success: true };
  }
}
