import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from '../../common/services/audit.service';
import { User } from '../auth/entities/user.entity';
import { AuditController } from './audit.controller';
import { AuditLogsService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, User])],
  controllers: [AuditController],
  providers: [AuditLogsService, AuditService],
  exports: [AuditLogsService, AuditService],
})
export class AuditModule {}
