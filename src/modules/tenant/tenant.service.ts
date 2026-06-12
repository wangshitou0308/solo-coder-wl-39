import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async findById(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }
    return tenant;
  }

  async update(
    tenantId: string,
    updateTenantDto: UpdateTenantDto,
    userId: string,
  ): Promise<Tenant> {
    const tenant = await this.findById(tenantId);
    Object.assign(tenant, updateTenantDto);
    tenant.updatedBy = userId;
    return this.tenantRepository.save(tenant);
  }
}
