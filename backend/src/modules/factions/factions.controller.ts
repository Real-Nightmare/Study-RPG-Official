import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FactionsService } from './factions.service';
import { currentPeriodKeyIST } from './faction-settlement';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Factions')
@Controller('factions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FactionsController {
  constructor(private readonly factions: FactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List factions (optionally for a programme)' })
  async list(@Query('programmeId') programmeId?: string) {
    await this.factions.settleIfDue();
    return this.factions.listForProgramme(programmeId || null);
  }

  @Get('mine')
  @ApiOperation({ summary: 'My faction' })
  async mine(@CurrentUser() user: JwtPayload) {
    return this.factions.myFaction(user.sub);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Faction leaderboard (triggers lazy settlement)' })
  async leaderboard(@Query('programmeId') programmeId?: string) {
    return this.factions.leaderboard(programmeId || null);
  }

  @Get('help-pledges')
  @ApiOperation({ summary: 'Active help pledges for the current period' })
  async helpPledges() {
    return this.factions.activeHelpPledges();
  }

  @Post('auto-assign')
  @ApiOperation({ summary: 'Auto-assign me to the smallest faction of a programme' })
  async autoAssign(@CurrentUser() user: JwtPayload, @Body() body: { programmeId?: string | null }) {
    return this.factions.autoAssign(user.sub, body.programmeId || null);
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Vote for a faction leader (top 2 elected each month)' })
  async vote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { candidateId: string },
  ) {
    await this.factions.vote(user.sub, id, body.candidateId);
    return { ok: true };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Faction members' })
  async members(@Param('id') id: string) {
    return this.factions.members(id);
  }

  @Get(':id/election')
  @ApiOperation({ summary: 'Current leader-election results' })
  async election(@Param('id') id: string) {
    return this.factions.electionResults(id);
  }

  @Post(':id/help')
  @ApiOperation({ summary: 'Record a help activity toward a weaker faction' })
  async help(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    await this.factions.recordHelpActivity({
      userId: user.sub,
      helpedFactionId: id,
      note: body.note,
    });
    return { ok: true };
  }

  @Post(':id/promote-leaders')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Promote the top-2 vote getters to leaders' })
  async promoteLeaders(@Param('id') id: string) {
    return this.factions.promoteLeaders(id);
  }

  @Post('settle')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Run the monthly (IST) settlement now' })
  async settle(@Body() body: { periodKey?: string }) {
    await this.factions.settle(body.periodKey || currentPeriodKeyIST());
    return { ok: true };
  }
}
