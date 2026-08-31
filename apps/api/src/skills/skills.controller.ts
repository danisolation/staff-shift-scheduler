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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  skillCreateSchema,
  skillListSchema,
  skillSchema,
  skillUpdateSchema,
  uuidParamSchema,
  type Skill,
  type SkillList,
} from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { zodToOpenAPISchema } from '../common/openapi/zod-to-openapi';
import { SkillsService } from './skills.service';

/**
 * Thin HTTP layer for /api/skills. The only job of a controller is
 * translating HTTP into plain calls and plain values back into HTTP:
 * validate the input against the shared contract, delegate to the service,
 * validate the output against the shared contract. No business logic here.
 *
 * Every handler documents itself in the OpenAPI reference (served at
 * /api/docs), with schemas derived from the same zod contracts the
 * runtime validation uses — the docs can never drift from the code.
 */
const requestBody = zodToOpenAPISchema(skillCreateSchema);
const updateBody = zodToOpenAPISchema(skillUpdateSchema);
const skillResponse = zodToOpenAPISchema(skillSchema);
const idParam = zodToOpenAPISchema(uuidParamSchema);

@ApiTags('Skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List all skills' })
  @ApiOkResponse({ description: 'All skills', schema: zodToOpenAPISchema(skillListSchema) })
  async list(): Promise<SkillList> {
    return skillListSchema.parse(await this.skillsService.findAll());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a skill' })
  @ApiBody({ schema: requestBody })
  @ApiCreatedResponse({ description: 'Skill created', schema: skillResponse })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiConflictResponse({ description: 'A skill with this name already exists' })
  async create(@Body() body: unknown): Promise<Skill> {
    const input = validateWithZod(skillCreateSchema, body);
    const skill = await this.skillsService.create(input);
    return skillSchema.parse(skill);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one skill by id' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiOkResponse({ description: 'The skill', schema: skillResponse })
  @ApiBadRequestResponse({ description: 'Invalid id (must be a UUID)' })
  @ApiNotFoundResponse({ description: 'Skill not found' })
  async getById(@Param('id') id: string): Promise<Skill> {
    validateWithZod(uuidParamSchema, id);
    return skillSchema.parse(await this.skillsService.findById(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a skill' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiBody({ schema: updateBody })
  @ApiOkResponse({ description: 'Updated skill', schema: skillResponse })
  @ApiBadRequestResponse({ description: 'Invalid id or body' })
  @ApiNotFoundResponse({ description: 'Skill not found' })
  @ApiConflictResponse({ description: 'A skill with this name already exists' })
  async update(@Param('id') id: string, @Body() body: unknown): Promise<Skill> {
    validateWithZod(uuidParamSchema, id);
    const patch = validateWithZod(skillUpdateSchema, body);
    return skillSchema.parse(await this.skillsService.update(id, patch));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a skill' })
  @ApiParam({ name: 'id', schema: idParam })
  @ApiNoContentResponse({ description: 'Skill deleted' })
  @ApiBadRequestResponse({ description: 'Invalid id (must be a UUID)' })
  @ApiNotFoundResponse({ description: 'Skill not found' })
  async remove(@Param('id') id: string): Promise<void> {
    validateWithZod(uuidParamSchema, id);
    await this.skillsService.delete(id);
  }
}
