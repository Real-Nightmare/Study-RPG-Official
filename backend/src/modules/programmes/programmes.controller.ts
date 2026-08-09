import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BatchReviewItem,
  CreateTemplateDto,
  ProgrammesService,
  ReviewProgrammeDto,
  SuggestProgrammeDto,
} from './programmes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Programmes')
@Controller('programmes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProgrammesController {
  constructor(private readonly programmes: ProgrammesService) {}

  @Post()
  @ApiOperation({ summary: 'Suggest a programme — the AI builds it immediately for everyone' })
  async suggest(@CurrentUser() user: JwtPayload, @Body() dto: SuggestProgrammeDto) {
    return this.programmes.suggest(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List programmes (active by default)' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('mine') mine?: string,
  ) {
    return this.programmes.list({
      status: status || (mine ? undefined : 'active'),
      kind,
      userId: user.sub,
      mine: mine === 'true',
    });
  }

  // ---------------- Templates (Phase 8) ----------------

  @Get('templates')
  @ApiOperation({ summary: 'List active programme templates (everyone)' })
  async listTemplates() {
    return this.programmes.listTemplates();
  }

  @Post('templates')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a programme template (admin, reason required)' })
  async createTemplate(@CurrentUser() user: JwtPayload, @Body() dto: CreateTemplateDto) {
    return this.programmes.createTemplate(user.sub, dto);
  }

  @Put('templates/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a programme template (admin, reason required)' })
  async updateTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: Partial<CreateTemplateDto> & { reason: string },
  ) {
    return this.programmes.updateTemplate(user.sub, id, dto);
  }

  @Delete('templates/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a programme template (admin, reason required)' })
  async deleteTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    await this.programmes.deleteTemplate(user.sub, id, body.reason);
    return { ok: true };
  }

  @Post('suggest-from-template')
  @ApiOperation({ summary: 'Suggest a programme from a template — the AI builds it immediately' })
  async suggestFromTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() body: { templateId: string; hasFactions?: boolean; factionSize?: number },
  ) {
    return this.programmes.suggestFromTemplate(user.sub, body.templateId, {
      hasFactions: body.hasFactions,
      factionSize: body.factionSize,
    });
  }

  // ---------------- Review queue & batch review (Phase 8) ----------------

  @Get('review-queue')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Programmes still waiting for a human review verdict' })
  async reviewQueue() {
    return this.programmes.reviewQueue();
  }

  @Post('batch-review')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Batch accept/reject programmes (reason required per item)' })
  async batchReview(@CurrentUser() user: JwtPayload, @Body() body: { items: BatchReviewItem[] }) {
    return this.programmes.batchReview(user.sub, body.items);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one programme (with review history)' })
  async get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.programmes.findOne(id, user.sub);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a programme' })
  async join(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.programmes.join(user.sub, id);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a programme' })
  async leave(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.programmes.leave(user.sub, id);
  }

  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin override of the AI review (reason required)' })
  async review(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewProgrammeDto,
  ) {
    return this.programmes.adminReview(user.sub, id, dto);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Archive a programme (reason required)' })
  async archive(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.programmes.archive(user.sub, id, body.reason);
  }
}
