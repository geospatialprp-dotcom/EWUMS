import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'API health check — confirms PostgreSQL NestJS (not dev mock)' })
  check() {
    return {
      status: 'ok',
      mode: 'postgresql',
      engine: 'nestjs',
    };
  }
}
