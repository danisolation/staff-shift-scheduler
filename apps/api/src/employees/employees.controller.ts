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
  employeeCreateSchema,
  employeeListSchema,
  employeeSchema,
  employeeUpdateSchema,
  uuidParamSchema,
  type Employee,
  type EmployeeList,
} from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { zodToOpenAPISchema } from '../common/openapi/zod-to-openapi';
import { EmployeesService } from './employees.service';

/** Thin HTTP layer for /api/employees. No business logic here. */
const requestBody = zodToOpenAPISchema(employeeCreateSchema);
const updateBody = zodToOpenAPISchema(employeeUpdateSchema);
const employeeResponse = zodToOpenAPISchema(employeeSchema);
const idParam = zodToOpenAPISchema(uuidParamSchema);

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'List all employees' })
  @ApiOkResponse({
    description: 'All employees',
    schema: zodToOpenAPISchema(employeeListSchema),
  })
  async list(): Promise<EmployeeList> {
    return employeeListSchema.parse(await this.employeesService.findAll());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an employee' })
  @ApiBody({ schema: requestBody })
  @ApiCreatedResponse({ description: 'Employee created', schema: employeeResponse })
  @ApiBadRequestResponse({ description: 'Invalid body or unknown skill id' })
  async create(@Body() body: unknown): Promise<Employee> {
    const input = validateWithZod(employeeCreateSchema, body);
    return employeeSchema.parse(await this.employeesService.create(input));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one employee by id' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiOkResponse({ description: 'The employee', schema: employeeResponse })
  @ApiBadRequestResponse({ description: 'Invalid id (must be a UUID)' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  async getById(@Param('id') id: string): Promise<Employee> {
    validateWithZod(uuidParamSchema, id);
    return employeeSchema.parse(await this.employeesService.findById(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update an employee' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiBody({ schema: updateBody })
  @ApiOkResponse({ description: 'Updated employee', schema: employeeResponse })
  @ApiBadRequestResponse({ description: 'Invalid id, body, or unknown skill id' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  async update(@Param('id') id: string, @Body() body: unknown): Promise<Employee> {
    validateWithZod(uuidParamSchema, id);
    const patch = validateWithZod(employeeUpdateSchema, body);
    return employeeSchema.parse(await this.employeesService.update(id, patch));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiNoContentResponse({ description: 'Employee deleted' })
  @ApiBadRequestResponse({ description: 'Invalid id (must be a UUID)' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  async remove(@Param('id') id: string): Promise<void> {
    validateWithZod(uuidParamSchema, id);
    await this.employeesService.delete(id);
  }
}
