import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole, TemplateCategory } from '../../common/enums';

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createTemplateDto: CreateTemplateDto,
  ) {
    return this.templateService.create(createTemplateDto, user.tenantId, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('name') name?: string,
    @Query('category') category?: TemplateCategory,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.templateService.findAll(
      {
        name,
        category,
        active: active !== undefined ? active === 'true' : undefined,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      user.tenantId,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templateService.findOne(id, user.tenantId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templateService.update(id, updateTemplateDto, user.tenantId, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templateService.remove(id, user.tenantId);
  }

  @Post('seed/presets')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  async seedPresets(@CurrentUser() user: CurrentUserPayload) {
    return this.templateService.seedPresetTemplates(user.tenantId, user.userId);
  }
}
