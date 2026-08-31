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
  shiftCreateSchema,
  shiftListSchema,
  shiftSchema,
  shiftUpdateSchema,
  uuidParamSchema,
  type Shift,
  type ShiftList,
} from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { ShiftsService } from './shifts.service';

/** Thin HTTP layer for /api/shifts. No business logic here. */
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  async list(): Promise<ShiftList> {
    return shiftListSchema.parse(await this.shiftsService.findAll());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<Shift> {
    const input = validateWithZod(shiftCreateSchema, body);
    return shiftSchema.parse(await this.shiftsService.create(input));
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Shift> {
    validateWithZod(uuidParamSchema, id);
    return shiftSchema.parse(await this.shiftsService.findById(id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown): Promise<Shift> {
    validateWithZod(uuidParamSchema, id);
    const patch = validateWithZod(shiftUpdateSchema, body);
    return shiftSchema.parse(await this.shiftsService.update(id, patch));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    validateWithZod(uuidParamSchema, id);
    await this.shiftsService.delete(id);
  }
}
