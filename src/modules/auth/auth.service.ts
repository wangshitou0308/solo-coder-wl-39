import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository, DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { UserRole } from '../../common/enums';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: [],
    });
    if (!user) {
      return null;
    }
    const isPasswordValid = await CryptoUtil.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }
    if (!user.active) {
      return null;
    }
    const { password: _password, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    const tenant = await this.tenantRepository.findOne({
      where: { id: user.tenantId },
    });
    if (!tenant || !tenant.active) {
      throw new UnauthorizedException('租户已被禁用');
    }
    const payload: CurrentUserPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingTenant = await queryRunner.manager.findOne(Tenant, {
        where: [
          { name: registerDto.tenantName },
          { code: registerDto.tenantCode },
        ],
      });
      if (existingTenant) {
        throw new ConflictException('租户名称或编码已存在');
      }

      const existingUser = await this.userRepository.findOne({
        where: { email: registerDto.email },
      });
      if (existingUser) {
        throw new ConflictException('该邮箱已被注册');
      }

      const tenant = queryRunner.manager.create(Tenant, {
        name: registerDto.tenantName,
        code: registerDto.tenantCode,
        active: true,
      });
      const savedTenant = await queryRunner.manager.save(tenant);

      const hashedPassword = await CryptoUtil.hashPassword(registerDto.password);
      const user = queryRunner.manager.create(User, {
        tenantId: savedTenant.id,
        name: registerDto.name,
        email: registerDto.email,
        phone: registerDto.phone,
        password: hashedPassword,
        role: UserRole.ADMIN,
        active: true,
      });
      const savedUser = await queryRunner.manager.save(user);

      await queryRunner.commitTransaction();

      const payload: CurrentUserPayload = {
        userId: savedUser.id,
        tenantId: savedTenant.id,
        role: savedUser.role,
        email: savedUser.email,
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: savedUser.id,
          name: savedUser.name,
          email: savedUser.email,
          role: savedUser.role,
          tenantId: savedTenant.id,
        },
        tenant: {
          id: savedTenant.id,
          name: savedTenant.name,
          code: savedTenant.code,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'tenantId', 'name', 'email', 'phone', 'role', 'signatureUrl', 'active', 'createdAt'],
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }
}
