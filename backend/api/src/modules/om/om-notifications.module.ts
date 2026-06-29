import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { AlertNotificationService } from './alert-notification.service';
import { BillingNotificationService } from './billing-notification.service';
import { OmAlertNotification } from './entities/om-alert-notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OmAlertNotification, User])],
  providers: [BillingNotificationService, AlertNotificationService],
  exports: [BillingNotificationService, AlertNotificationService],
})
export class OmNotificationsModule {}
