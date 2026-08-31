import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@scheduler/contracts';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      uptimeSeconds: (Date.now() - this.startedAt) / 1000,
      timestamp: new Date().toISOString(),
    };
  }
}
