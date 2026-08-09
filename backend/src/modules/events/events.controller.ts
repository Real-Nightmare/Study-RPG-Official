import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { StudyEventsService, EventView } from './events.service';
import { QuestsService } from './quests.service';
import { AbstractedService } from './abstracted.service';
import { ExtinctionService } from './extinction.service';
import {
  ActivateEventDto,
  ChooseTrackDto,
  ClaimLevelDto,
  CreateEventDto,
  LimboDto,
  SeedTargetsDto,
  TransferSigilDto,
  UnabstractDto,
} from './dto/events.dto';

interface AuthedRequest {
  user?: { sub?: string };
}

/**
 * PDF Phase 7 — Events API. Everything is JWT-guarded by the global guards;
 * admin routes additionally require the ADMIN role and a reason (audited).
 */
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: StudyEventsService,
    private readonly quests: QuestsService,
    private readonly abstracted: AbstractedService,
    private readonly extinction: ExtinctionService,
  ) {}

  private userId(req: AuthedRequest): string {
    const sub = req.user?.sub;
    if (!sub) throw new BadRequestException('Authentication required');
    return sub;
  }

  // -------------------------------------------------------------------------
  // Current event & catalogue
  // -------------------------------------------------------------------------

  @Get('current')
  async current(@Req() req: AuthedRequest) {
    return this.events.currentEventView(this.userId(req));
  }

  @Get('loot-box-odds')
  async lootBoxOdds() {
    const config = await this.events.getConfig();
    return config.lootBoxes;
  }

  @Get('current/quests')
  async currentQuests(@Req() req: AuthedRequest) {
    const event = await this.requireActiveEvent();
    return this.quests.listForEvent(this.userId(req), event.id);
  }

  @Get('current/items')
  async currentItems(@Req() req: AuthedRequest) {
    return (await this.events.currentEventView(this.userId(req)))?.items ?? [];
  }

  @Get()
  async list() {
    return this.events.listEvents();
  }

  @Get('abstracted/my')
  async myAbstracted(@Req() req: AuthedRequest) {
    return this.abstracted.myAbstracted(this.userId(req));
  }

  @Get(':slug')
  async bySlug(@Param('slug') slug: string, @Req() req: AuthedRequest) {
    const event = await this.events.getBySlug(slug);
    return {
      event,
      studyPass: await this.events.studyPassState(this.userId(req), event.id),
    };
  }

  // -------------------------------------------------------------------------
  // Admin: scheduling (audited, reason required)
  // -------------------------------------------------------------------------

  @Post()
  @Roles(Role.ADMIN)
  async create(@Req() req: AuthedRequest, @Body() dto: CreateEventDto) {
    return this.events.createEvent(this.userId(req), {
      ...dto,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
    });
  }

  @Post(':id/activate')
  @Roles(Role.ADMIN)
  async activate(@Param('id') id: string, @Req() req: AuthedRequest, @Body() dto: ActivateEventDto) {
    return this.events.activateEvent(this.userId(req), id, dto.reason);
  }

  // -------------------------------------------------------------------------
  // StudyPass & tracks
  // -------------------------------------------------------------------------

  @Post('current/study-pass/track')
  async chooseTrack(@Req() req: AuthedRequest, @Body() dto: ChooseTrackDto) {
    const event = await this.requireActiveEvent();
    return this.events.chooseTrack(this.userId(req), event.id, dto.track);
  }

  @Post('current/study-pass/claim')
  async claimLevel(@Req() req: AuthedRequest, @Body() dto: ClaimLevelDto) {
    const event = await this.requireActiveEvent();
    return this.events.claimLevel(this.userId(req), event.id, dto.level);
  }

  // -------------------------------------------------------------------------
  // Quests
  // -------------------------------------------------------------------------

  @Post('current/quests/:id/claim')
  async claimQuest(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.quests.claim(this.userId(req), id);
  }

  // -------------------------------------------------------------------------
  // Extinction Sigils
  // -------------------------------------------------------------------------

  @Post('current/sigils/transfer')
  async transferSigil(@Req() req: AuthedRequest, @Body() dto: TransferSigilDto) {
    await this.extinction.transferSigil(this.userId(req), dto.toUserId, dto.quantity);
    return { transferred: true, quantity: dto.quantity, toUserId: dto.toUserId };
  }

  // -------------------------------------------------------------------------
  // Abstracted event
  // -------------------------------------------------------------------------

  @Post('abstracted/unabstract')
  async unabstract(@Req() req: AuthedRequest, @Body() dto: UnabstractDto) {
    return this.abstracted.unabstract(this.userId(req), dto.instanceId, dto);
  }

  @Post('abstracted/limbo')
  async limbo(@Req() req: AuthedRequest, @Body() dto: LimboDto) {
    return this.abstracted.limbo(this.userId(req), dto);
  }

  // -------------------------------------------------------------------------
  // Great Extinction: targets & milestones
  // -------------------------------------------------------------------------

  @Get(':slug/extinction/targets')
  async targets(@Param('slug') slug: string) {
    const event = await this.events.getBySlug(slug);
    await this.extinction.ensureTargets(event.id);
    return this.extinction.listTargets(event.id);
  }

  @Post(':slug/extinction/targets')
  @Roles(Role.ADMIN)
  async seedTargets(
    @Param('slug') slug: string,
    @Req() req: AuthedRequest,
    @Body() dto: SeedTargetsDto,
  ) {
    const event = await this.events.getBySlug(slug);
    if (dto.cardKeys && dto.cardKeys.length > 0) {
      return this.extinction.overrideTargets(this.userId(req), event.id, dto.cardKeys, dto.reason);
    }
    await this.extinction.ensureTargets(event.id);
    return this.extinction.listTargets(event.id);
  }

  @Get(':slug/milestones')
  async milestones(@Param('slug') slug: string, @Req() req: AuthedRequest) {
    const event = await this.events.getBySlug(slug);
    await this.extinction.ensureMilestone(event.id);
    return this.extinction.listMilestones(this.userId(req), event.id);
  }

  @Post(':slug/milestones/:id/claim')
  async claimMilestone(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.extinction.claimMilestone(this.userId(req), id);
    return { claimed: true };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async requireActiveEvent(): Promise<EventView> {
    const event = await this.events.ensureActiveEvent();
    if (!event) {
      throw new BadRequestException('No active event right now');
    }
    return event;
  }
}
