import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { CancelContractDto } from './dto/cancel-contract.dto';
import { VoidContractDto, ConfirmVoidDto } from './dto/void-contract.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createContractDto: CreateContractDto,
  ) {
    return this.contractService.create(createContractDto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryContractDto,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('pageSize', ParseIntPipe) pageSize: number = 10,
  ) {
    return this.contractService.findAll(query, user, page, pageSize);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.contractService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
  ) {
    return this.contractService.update(id, updateContractDto, user);
  }

  @Post(':id/launch')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  @HttpCode(HttpStatus.OK)
  launch(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.contractService.launch(id, user);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() cancelContractDto: CancelContractDto,
  ) {
    return this.contractService.cancel(id, cancelContractDto, user);
  }

  @Post(':id/void')
  @Roles(UserRole.ADMIN, UserRole.INITIATOR)
  @HttpCode(HttpStatus.OK)
  voidContract(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() voidContractDto: VoidContractDto,
  ) {
    return this.contractService.voidContract(id, voidContractDto, user);
  }

  @Post('void/:voidRequestId/confirm/:signerId')
  @HttpCode(HttpStatus.OK)
  confirmVoid(
    @CurrentUser() user: CurrentUserPayload,
    @Param('voidRequestId') voidRequestId: string,
    @Param('signerId') signerId: string,
    @Body() confirmVoidDto: ConfirmVoidDto,
  ) {
    return this.contractService.confirmVoid(
      voidRequestId,
      signerId,
      confirmVoidDto,
      user,
    );
  }

  @Get('void/:voidRequestId')
  findVoidRequest(
    @CurrentUser() user: CurrentUserPayload,
    @Param('voidRequestId') voidRequestId: string,
  ) {
    return this.contractService.findVoidRequest(voidRequestId, user);
  }
}
