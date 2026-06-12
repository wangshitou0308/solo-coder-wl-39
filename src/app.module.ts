import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { ContractModule } from './modules/contract/contract.module';
import { TemplateModule } from './modules/template/template.module';
import { SigningModule } from './modules/signing/signing.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { BatchModule } from './modules/batch/batch.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { TasksModule } from './modules/tasks/tasks.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'esign_contract',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    TenantModule,
    UserModule,
    TemplateModule,
    ContractModule,
    SigningModule,
    ArchiveModule,
    BatchModule,
    DashboardModule,
    NotificationModule,
    PdfModule,
    TasksModule,
  ],
})
export class AppModule {}
