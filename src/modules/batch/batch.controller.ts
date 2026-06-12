import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { BatchService } from './batch.service';
import { BatchRemindDto } from './dto/batch-remind.dto';
import { BatchExportDto } from './dto/batch-export.dto';
import { BatchDownloadDto } from './dto/batch-download.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

@Controller('batch')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Post('remind')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  @HttpCode(HttpStatus.OK)
  batchSendReminders(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BatchRemindDto,
  ) {
    return this.batchService.batchSendReminders(dto, user);
  }

  @Post('export')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  batchExportCsv(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BatchExportDto,
  ) {
    return this.batchService.batchExportCsv(dto, user);
  }

  @Post('download')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  @HttpCode(HttpStatus.OK)
  batchDownloadContracts(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BatchDownloadDto,
  ) {
    return this.batchService.batchDownloadContracts(dto, user);
  }

  @Get('download/:filename')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  async downloadZipFile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = this.batchService.getDownloadFilePath(filename, user.tenantId);
    res.download(filePath, filename);
  }
}
