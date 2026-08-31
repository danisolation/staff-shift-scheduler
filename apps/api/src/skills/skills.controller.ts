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
  skillCreateSchema,
  skillListSchema,
  skillSchema,
  skillUpdateSchema,
  uuidParamSchema,
  type Skill,
  type SkillList,
} from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { SkillsService } from './skills.service';

/**
 * Thin HTTP layer for /api/skills. The only job of a controller is
 * translating HTTP into plain calls and plain values back into HTTP:
 * validate the input against the shared contract, delegate to the service,
 * validate the output against the shared contract. No business logic here.
 */
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  async list(): Promise<SkillList> {
    return skillListSchema.parse(await this.skillsService.findAll());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<Skill> {
    const input = validateWithZod(skillCreateSchema, body);
    const skill = await this.skillsService.create(input);
    return skillSchema.parse(skill);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Skill> {
    validateWithZod(uuidParamSchema, id);
    return skillSchema.parse(await this.skillsService.findById(id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown): Promise<Skill> {
    validateWithZod(uuidParamSchema, id);
    const patch = validateWithZod(skillUpdateSchema, body);
    return skillSchema.parse(await this.skillsService.update(id, patch));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    validateWithZod(uuidParamSchema, id);
    await this.skillsService.delete(id);
  }
}
