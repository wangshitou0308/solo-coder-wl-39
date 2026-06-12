import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { SealService } from './seal.service';
import { SealController } from './seal.controller';
import { Tenant } from './entities/tenant.entity';
import { Seal } from './entities/seal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Seal])],
  controllers: [TenantController, SealController],
  providers: [TenantService, SealService],
  exports: [TenantService, SealService],
})
export class TenantModule {}
