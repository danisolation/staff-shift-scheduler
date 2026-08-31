import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  shiftCreateSchema,
  shiftListSchema,
  shiftSchema,
  shiftUpdateSchema,
  uuidParamSchema,
  type Shift,
  type ShiftList,
} from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { zodToOpenAPISchema } from '../common/openapi/zod-to-openapi';
import { ShiftsService } from './shifts.service';

/** Thin HTTP layer for /api/shifts. No business logic here. */
const requestBody = zodToOpenAPISchema(shiftCreateSchema);
const updateBody = zodToOpenAPISchema(shiftUpdateSchema);
const shiftResponse = zodToOpenAPISchema(shiftSchema);
const idParam = zodToOpenAPISchema(uuidParamSchema);

@ApiTags('Shifts')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'List all shifts' })
  @ApiOkResponse({ description: 'All shifts', schema: zodToOpenAPISchema(shiftListSchema) })
  async list(): Promise<ShiftList> {
    return shiftListSchema.parse(await this.shiftsService.findAll());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shift' })
  @ApiBody({ schema: requestBody })
  @ApiCreatedResponse({ description: 'Shift created', schema: shiftResponse })
  @ApiBadRequestResponse({ description: 'Invalid body or unknown skill id' })
  async create(@Body() body: unknown): Promise<Shift> {
    const input = validateWithZod(shiftCreateSchema, body);
    return shiftSchema.parse(await this.shiftsService.create(input));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one shift by id' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiOkResponse({ description: 'The shift', schema: shiftResponse })
  @ApiBadRequestResponse({ description: 'Invalid id (must be a UUID)' })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  async getById(@Param('id') id: string): Promise<Shift> {
    validateWithZod(uuidParamSchema, id);
    return shiftSchema.parse(await this.shiftsService.findById(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a shift' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiBody({ schema: updateBody })
  @ApiOkResponse({ description: 'Updated shift', schema: shiftResponse })
  @ApiBadRequestResponse({ description: 'Invalid id, body, or unknown skill id' })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  async update(@Param('id') id: string, @Body() body: unknown): Promise<Shift> {
    validateWithZod(uuidParamSchema, id);
    const patch = validateWithZod(shiftUpdateSchema, body);
    return shiftSchema.parse(await this.shiftsService.update(id, patch));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shift' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiNoContentResponse({ description: 'Shift deleted' })
  @ApiBadRequestResponse({ description: 'Invalid id (must be a UUID)' })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  async remove(@Param('id') id: string): Promise<void> {
    validateWithZod(uuidParamSchema, id);
    await this.shiftsService.delete(id);
  }
}
