import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { Contract } from '../contract/entities/contract.entity';
import { Signer } from '../signing/entities/signer.entity';
import { Archive } from '../archive/entities/archive.entity';
import { Notification } from '../notification/entities/notification.entity';
import { ContractTimeline } from '../contract/entities/contract-timeline.entity';
import { User } from '../user/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Signer,
      Archive,
      Notification,
      ContractTimeline,
      User,
    ]),
    NotificationModule,
  ],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
