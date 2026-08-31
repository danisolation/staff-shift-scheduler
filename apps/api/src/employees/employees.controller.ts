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
  employeeCreateSchema,
  employeeListSchema,
  employeeSchema,
  employeeUpdateSchema,
  uuidParamSchema,
  type Employee,
  type EmployeeList,
} from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { EmployeesService } from './employees.service';

/** Thin HTTP layer for /api/employees. No business logic here. */
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  async list(): Promise<EmployeeList> {
    return employeeListSchema.parse(await this.employeesService.findAll());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<Employee> {
    const input = validateWithZod(employeeCreateSchema, body);
    return employeeSchema.parse(await this.employeesService.create(input));
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Employee> {
    validateWithZod(uuidParamSchema, id);
    return employeeSchema.parse(await this.employeesService.findById(id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown): Promise<Employee> {
    validateWithZod(uuidParamSchema, id);
    const patch = validateWithZod(employeeUpdateSchema, body);
    return employeeSchema.parse(await this.employeesService.update(id, patch));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    validateWithZod(uuidParamSchema, id);
    await this.employeesService.delete(id);
  }
}
