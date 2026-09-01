import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  solveJobSchema,
  solveRequestSchema,
  uuidParamSchema,
  type SolveJob,
} from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { zodToOpenAPISchema } from '../common/openapi/zod-to-openapi';
import { SolvesService } from './solves.service';

/**
 * Thin HTTP layer for /api/solves — the async job pattern (ADR-005).
 * POST accepts the problem and answers with the queued job at once; the
 * actual solve runs in the background and is read back by polling GET :id.
 */
const requestBody = zodToOpenAPISchema(solveRequestSchema);
const jobResponse = zodToOpenAPISchema(solveJobSchema);
const idParam = zodToOpenAPISchema(uuidParamSchema);

@ApiTags('Solves')
@Controller('solves')
export class SolvesController {
  constructor(private readonly solvesService: SolvesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start an asynchronous schedule solve' })
  @ApiBody({ schema: requestBody })
  @ApiCreatedResponse({
    description: 'Job accepted with status "queued" — poll GET /solves/:id for the result',
    schema: jobResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid body (shape or unknown skill reference)' })
  async create(@Body() body: unknown): Promise<SolveJob> {
    const input = validateWithZod(solveRequestSchema, body);
    return solveJobSchema.parse(await this.solvesService.create(input));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Poll one solve job (queued → running → terminal status)' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiOkResponse({ description: 'The job with its current status and result (when finished)', schema: jobResponse })
  @ApiBadRequestResponse({ description: 'Invalid id (must be a UUID)' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async getById(@Param('id') id: string): Promise<SolveJob> {
    validateWithZod(uuidParamSchema, id);
    return solveJobSchema.parse(await this.solvesService.findById(id));
  }
}
