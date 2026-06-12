import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '../../common/enums';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

export interface PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(
    tenantId: string,
    page: number = 1,
    pageSize: number = 10,
    filters?: {
      name?: string;
      email?: string;
      role?: UserRole;
      active?: boolean;
    },
  ): Promise<PaginatedUsers> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    queryBuilder.where('user.tenantId = :tenantId', { tenantId });

    if (filters?.name) {
      queryBuilder.andWhere('user.name ILIKE :name', { name: `%${filters.name}%` });
    }

    if (filters?.email) {
      queryBuilder.andWhere('user.email ILIKE :email', { email: `%${filters.email}%` });
    }

    if (filters?.role) {
      queryBuilder.andWhere('user.role = :role', { role: filters.role });
    }

    if (filters?.active !== undefined) {
      queryBuilder.andWhere('user.active = :active', { active: filters.active });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    data.forEach((user) => {
      delete (user as any).password;
    });

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async findOne(tenantId: string, id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    delete (user as any).password;
    return user;
  }

  async create(
    currentUser: CurrentUserPayload,
    createUserDto: CreateUserDto,
  ): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: {
        tenantId: currentUser.tenantId,
        email: createUserDto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('该邮箱已存在');
    }

    const hashedPassword = await CryptoUtil.hashPassword(createUserDto.password);

    const user = this.userRepository.create({
      ...createUserDto,
      tenantId: currentUser.tenantId,
      password: hashedPassword,
      role: createUserDto.role ?? UserRole.VIEWER,
      active: true,
    });

    const savedUser = await this.userRepository.save(user);
    delete (savedUser as any).password;
    return savedUser;
  }

  async update(
    currentUser: CurrentUserPayload,
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId: currentUser.tenantId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isAdmin = currentUser.role === UserRole.ADMIN;
    const isSelf = currentUser.userId === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('无权限修改该用户');
    }

    if (updateUserDto.role !== undefined && !isAdmin) {
      throw new ForbiddenException('仅管理员可修改角色');
    }

    Object.assign(user, updateUserDto);
    const savedUser = await this.userRepository.save(user);
    delete (savedUser as any).password;
    return savedUser;
  }

  async remove(currentUser: CurrentUserPayload, id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId: currentUser.tenantId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    user.active = false;
    await this.userRepository.save(user);
  }

  async updatePassword(
    currentUser: CurrentUserPayload,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: currentUser.userId, tenantId: currentUser.tenantId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isPasswordValid = await CryptoUtil.comparePassword(
      oldPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    user.password = await CryptoUtil.hashPassword(newPassword);
    await this.userRepository.save(user);
  }
}
