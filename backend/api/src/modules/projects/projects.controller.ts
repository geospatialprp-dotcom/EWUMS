import {
  Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ProjectDivisionGuard } from '../../common/guards/project-division.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

const ORTHOMOSAIC_UPLOAD_LIMIT = 300 * 1024 * 1024;

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'List all projects' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.projectsService.findAll(user.tenantId, user);
  }

  @Get('portfolio-readiness')
  @RequirePermissions('project:read')
  @ApiOperation({ summary: 'Construction portfolio readiness (tender-published gate)' })
  portfolioReadiness(@CurrentUser() user: JwtPayload) {
    return this.projectsService.getPortfolioReadiness(user.tenantId, user);
  }

  @Get(':id')
  @RequirePermissions('project:read')
  @UseGuards(ProjectDivisionGuard)
  @ApiOperation({ summary: 'Get project by ID with milestones' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.projectsService.findOne(user.tenantId, id, user);
  }

  @Post()
  @RequirePermissions('project:create')
  @ApiOperation({ summary: 'Create a new project' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.tenantId, dto, user);
  }

  @Patch(':id')
  @RequirePermissions('project:update')
  @UseGuards(ProjectDivisionGuard)
  @ApiOperation({ summary: 'Update project details' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.tenantId, id, dto, user);
  }

  @Post(':id/orthomosaic/upload')
  @RequirePermissions('project:update')
  @UseGuards(ProjectDivisionGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: ORTHOMOSAIC_UPLOAD_LIMIT },
  }))
  @ApiOperation({ summary: 'Upload GeoTIFF orthomosaic for a project' })
  uploadOrthomosaic(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string; size?: number },
    @Body('name') name?: string,
  ) {
    return this.projectsService.uploadOrthomosaicFile(user.tenantId, id, file, name, user);
  }

  @Get(':id/orthomosaic/file')
  @RequirePermissions('project:read')
  @UseGuards(ProjectDivisionGuard)
  @ApiOperation({ summary: 'Download uploaded orthomosaic GeoTIFF' })
  async downloadOrthomosaicFile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { absolutePath, fileName, mimeType, size } = await this.projectsService.resolveOrthomosaicFile(
      user.tenantId,
      id,
      user,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(size));
    createReadStream(absolutePath).pipe(res);
  }

  @Delete(':id/orthomosaic')
  @RequirePermissions('project:update')
  @UseGuards(ProjectDivisionGuard)
  @ApiOperation({ summary: 'Remove orthomosaic file and clear project orthomosaic config' })
  removeOrthomosaic(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.projectsService.removeOrthomosaic(user.tenantId, id, user);
  }

  @Delete(':id')
  @RequirePermissions('project:delete')
  @ApiOperation({ summary: 'Delete a project (Super Admin only)' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.projectsService.remove(user.tenantId, id, user);
  }
}
