import { Controller, Get } from '@nestjs/common';
import { healthResponseSchema, type HealthResponse } from '@scheduler/contracts';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthResponse {
    // Controllers stay thin: parse nothing, decide nothing — just delegate.
    return healthResponseSchema.parse(this.healthService.getHealth());
  }
}
