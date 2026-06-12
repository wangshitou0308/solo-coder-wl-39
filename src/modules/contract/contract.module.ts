import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { Contract } from './entities/contract.entity';
import { ContractTimeline } from './entities/contract-timeline.entity';
import { VoidRequest } from './entities/void-request.entity';
import { VoidRequestSigner } from './entities/void-request-signer.entity';
import { Signer } from '../signing/entities/signer.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { NotificationModule } from '../notification/notification.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      ContractTimeline,
      VoidRequest,
      VoidRequestSigner,
      Signer,
      Tenant,
    ]),
    NotificationModule,
    PdfModule,
  ],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
