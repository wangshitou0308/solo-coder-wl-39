import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SigningService } from './signing.service';
import { SigningController } from './signing.controller';
import { Signer } from './entities/signer.entity';
import { Contract } from '../contract/entities/contract.entity';
import { ContractTimeline } from '../contract/entities/contract-timeline.entity';
import { NotificationModule } from '../notification/notification.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signer, Contract, ContractTimeline]),
    NotificationModule,
    PdfModule,
  ],
  controllers: [SigningController],
  providers: [SigningService],
  exports: [SigningService],
})
export class SigningModule {}
