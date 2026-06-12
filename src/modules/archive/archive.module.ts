import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveService } from './archive.service';
import { ArchiveController } from './archive.controller';
import { Archive } from './entities/archive.entity';
import { Contract } from '../contract/entities/contract.entity';
import { ContractTimeline } from '../contract/entities/contract-timeline.entity';
import { Signer } from '../signing/entities/signer.entity';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Archive, Contract, ContractTimeline, Signer]),
    PdfModule,
  ],
  controllers: [ArchiveController],
  providers: [ArchiveService],
  exports: [ArchiveService],
})
export class ArchiveModule {}
