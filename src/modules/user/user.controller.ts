import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdatePasswordDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('pageSize', ParseIntPipe) pageSize: number = 10,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('role') role?: UserRole,
    @Query('active') active?: string,
  ) {
    const filters = {
      name,
      email,
      role,
      active: active !== undefined ? active === 'true' : undefined,
    };
    return this.userService.findAll(currentUser.tenantId, page, pageSize, filters);
  }

  @Get('me')
  getMe(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.userService.findOne(currentUser.tenantId, currentUser.userId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.userService.findOne(currentUser.tenantId, id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.userService.create(currentUser, createUserDto);
  }

  @Patch(':id')
  update(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(currentUser, id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.userService.remove(currentUser, id);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  updatePassword(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.userService.updatePassword(
      currentUser,
      updatePasswordDto.oldPassword,
      updatePasswordDto.newPassword,
    );
  }
}
