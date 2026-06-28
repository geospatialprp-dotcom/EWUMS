import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveDivisionInterceptor } from './common/interceptors/active-division.interceptor';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { DivisionsModule } from './modules/divisions/divisions.module';
import { AuthModule } from './modules/auth/auth.module';
import { AssetsModule } from './modules/assets/assets.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GisModule } from './modules/gis/gis.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { ConstructionModule } from './modules/construction/construction.module';
import { OmModule } from './modules/om/om.module';
import { DprPlanningModule } from './modules/dpr-planning/dpr-planning.module';
import { LandAcquisitionModule } from './modules/land-acquisition/land-acquisition.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'egip'),
        password: config.get('DB_PASSWORD', 'egip_secret'),
        database: config.get('DB_DATABASE', 'egip'),
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    DivisionsModule,
    AuthModule,
    TenantsModule,
    AssetsModule,
    GisModule,
    ProjectsModule,
    DashboardModule,
    UsersModule,
    RolesModule,
    WorkflowsModule,
    ConstructionModule,
    OmModule,
    DprPlanningModule,
    LandAcquisitionModule,
    AuditModule,
  ],
  providers: [
    PermissionsGuard,
    { provide: APP_INTERCEPTOR, useClass: ActiveDivisionInterceptor },
  ],
  controllers: [HealthController],
})
export class AppModule {}
