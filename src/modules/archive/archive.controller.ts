import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Patch,
  UseGuards,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ArchiveService } from './archive.service';
import { QueryArchiveDto } from './dto/query-archive.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

@Controller('archives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Post(':contractId')
  @HttpCode(HttpStatus.OK)
  archiveContract(
    @CurrentUser() user: CurrentUserPayload,
    @Param('contractId') contractId: string,
  ) {
    return this.archiveService.archiveContract(contractId, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryArchiveDto,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('pageSize', ParseIntPipe) pageSize: number = 10,
  ) {
    return this.archiveService.findAll(query, user, page, pageSize);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.archiveService.findOne(id, user);
  }

  @Get(':id/download/certificate')
  downloadCertificate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.archiveService.downloadCertificate(id, user);
  }

  @Get(':id/download/contract')
  downloadContract(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.archiveService.downloadContract(id, user);
  }

  @Get(':id/evidence-chain')
  getEvidenceChain(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.archiveService.getEvidenceChain(id, user);
  }

  @Patch(':id/extend-retention')
  @Roles(UserRole.ADMIN)
  extendRetention(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body('days', ParseIntPipe) days: number,
  ) {
    return this.archiveService.extendRetention(id, days, user);
  }

  @Patch(':id/reminder-sent')
  @HttpCode(HttpStatus.OK)
  markReminderSent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.archiveService.markReminderSent(id, user);
  }
}
