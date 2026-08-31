import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { healthResponseSchema, type HealthResponse } from '@scheduler/contracts';
import { zodToOpenAPISchema } from '../common/openapi/zod-to-openapi';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check that the api is up' })
  @ApiOkResponse({
    description: 'The api is running',
    schema: zodToOpenAPISchema(healthResponseSchema),
  })
  getHealth(): HealthResponse {
    // Controllers stay thin: parse nothing, decide nothing — just delegate.
    return healthResponseSchema.parse(this.healthService.getHealth());
  }
}
