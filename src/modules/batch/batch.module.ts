import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchService } from './batch.service';
import { BatchController } from './batch.controller';
import { Contract } from '../contract/entities/contract.entity';
import { Signer } from '../signing/entities/signer.entity';
import { Archive } from '../archive/entities/archive.entity';
import { User } from '../user/entities/user.entity';
import { SigningModule } from '../signing/signing.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Signer, Archive, User]),
    SigningModule,
    NotificationModule,
  ],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
