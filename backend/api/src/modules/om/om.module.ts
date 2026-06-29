import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AssetType } from '../assets/entities/asset-type.entity';
import { Asset } from '../assets/entities/asset.entity';
import { ConstructionAsset } from '../construction/entities/construction-asset.entity';
import { ProjectCompletion } from '../construction/entities/project-completion.entity';
import { Project } from '../projects/entities/project.entity';
import { WorkflowTask } from '../workflows/entities/workflow-task.entity';
import { WorkflowsModule } from '../workflows/workflows.module';
import { OmBreakdownTicket } from './entities/om-breakdown-ticket.entity';
import { OmHandoverDocument } from './entities/om-handover-document.entity';
import { OmHandover } from './entities/om-handover.entity';
import { OmInspection } from './entities/om-inspection.entity';
import { OmPmSchedule } from './entities/om-pm-schedule.entity';
import { OmWaterQualityTest } from './entities/om-water-quality-test.entity';
import { OmEnergyReading } from './entities/om-energy-reading.entity';
import { OmScadaReading } from './entities/om-scada-reading.entity';
import { OmScadaAlert } from './entities/om-scada-alert.entity';
import { OmConsumer } from './entities/om-consumer.entity';
import { OmConsumerServiceRequest } from './entities/om-consumer-service-request.entity';
import { OmConsumerComplaint } from './entities/om-consumer-complaint.entity';
import { OmContract } from './entities/om-contract.entity';
import { OmContractAttendance } from './entities/om-contract-attendance.entity';
import { OmContractKpiEntry } from './entities/om-contract-kpi-entry.entity';
import { OmContractReview } from './entities/om-contract-review.entity';
import { OmAssetLifecycleAssessment } from './entities/om-asset-lifecycle-assessment.entity';
import { OmRenewalPlan } from './entities/om-renewal-plan.entity';
import { OmBillingTariff } from './entities/om-billing-tariff.entity';
import { OmMeterReading } from './entities/om-meter-reading.entity';
import { OmConsumerBill } from './entities/om-consumer-bill.entity';
import { OmBillingPayment } from './entities/om-billing-payment.entity';
import { User } from '../auth/entities/user.entity';
import { OmChartOfAccount } from './entities/om-chart-of-account.entity';
import { OmJournalEntry } from './entities/om-journal-entry.entity';
import { OmJournalLine } from './entities/om-journal-line.entity';
import { OmAccountingPosting } from './entities/om-accounting-posting.entity';
import { OmController } from './om.controller';
import { OmAssetService } from './om-asset.service';
import { OmBreakdownService } from './om-breakdown.service';
import { OmInspectionService } from './om-inspection.service';
import { OmPmService } from './om-pm.service';
import { OmWqService } from './om-wq.service';
import { OmEnergyService } from './om-energy.service';
import { OmScadaService } from './om-scada.service';
import { OmConsumerService } from './om-consumer.service';
import { OmComplaintService } from './om-complaint.service';
import { OmContractService } from './om-contract.service';
import { OmLifecycleService } from './om-lifecycle.service';
import { OmDashboardService } from './om-dashboard.service';
import { OmReportsService } from './om-reports.service';
import { OmBillingService } from './om-billing.service';
import { OmAccountingService } from './om-accounting.service';
import { OmMobileBillingService } from './om-mobile-billing.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { OmNotificationsModule } from './om-notifications.module';
import { ConsumerPortalAuthService } from './consumer-portal-auth.service';
import { ConsumerPortalService } from './consumer-portal.service';
import { ConsumerPortalController } from './consumer-portal.controller';
import { JalMitraController } from './jal-mitra.controller';
import { JalMitraService } from './jal-mitra.service';
import { JalMitraKnowledgeService } from './jal-mitra/jal-mitra-knowledge.service';
import { JalMitraLlmService } from './jal-mitra/jal-mitra-llm.service';
import { ConsumerPortalOtpService } from './consumer-portal-otp.service';
import { JalMitraSession } from './entities/jal-mitra-session.entity';
import { JalMitraMessage } from './entities/jal-mitra-message.entity';
import { JalMitraKnowledgeArticle } from './entities/jal-mitra-knowledge-article.entity';
import { ConsumerPortalOtpChallenge } from './entities/consumer-portal-otp-challenge.entity';
import { OmConsumerNotification } from './entities/om-consumer-notification.entity';
import { OmAlertNotification } from './entities/om-alert-notification.entity';
import { ConsumerNotificationService } from './consumer-notification.service';
import { OmService } from './om.service';
import { OmDivisionScopeService } from './om-division-scope.service';

@Module({
  imports: [
    WorkflowsModule,
    OmNotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'egip-dev-secret-change-in-production'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '8h') },
      }),
    }),
    TypeOrmModule.forFeature([
      OmHandover,
      OmBreakdownTicket,
      OmHandoverDocument,
      OmInspection,
      OmPmSchedule,
      OmWaterQualityTest,
      OmEnergyReading,
      OmScadaReading,
      OmScadaAlert,
      OmConsumer,
      OmConsumerServiceRequest,
      OmConsumerComplaint,
      OmContract,
      OmContractAttendance,
      OmContractKpiEntry,
      OmContractReview,
      OmAssetLifecycleAssessment,
      OmRenewalPlan,
      OmBillingTariff,
      OmMeterReading,
      OmConsumerBill,
      OmBillingPayment,
      OmChartOfAccount,
      OmJournalEntry,
      OmJournalLine,
      OmAccountingPosting,
      User,
      Asset,
      AssetType,
      Project,
      ProjectCompletion,
      ConstructionAsset,
      WorkflowTask,
      JalMitraSession,
      JalMitraMessage,
      JalMitraKnowledgeArticle,
      ConsumerPortalOtpChallenge,
      OmConsumerNotification,
      OmAlertNotification,
    ]),
  ],
  controllers: [OmController, ConsumerPortalController, JalMitraController],
  providers: [OmDivisionScopeService, OmService, OmAssetService, OmInspectionService, OmPmService, OmBreakdownService, OmWqService, OmEnergyService, OmScadaService, OmConsumerService, OmComplaintService, OmContractService, OmLifecycleService, OmDashboardService, OmReportsService, ConsumerNotificationService, OmBillingService, OmAccountingService, OmMobileBillingService, PaymentGatewayService, ConsumerPortalAuthService, ConsumerPortalService, ConsumerPortalOtpService, JalMitraKnowledgeService, JalMitraLlmService, JalMitraService],
  exports: [OmService, OmAssetService, OmInspectionService, OmPmService, OmBreakdownService, OmWqService, OmEnergyService, OmScadaService, OmConsumerService, OmComplaintService, OmContractService, OmLifecycleService, OmDashboardService, OmReportsService, OmNotificationsModule, OmBillingService, OmAccountingService, OmMobileBillingService],
})
export class OmModule {}
