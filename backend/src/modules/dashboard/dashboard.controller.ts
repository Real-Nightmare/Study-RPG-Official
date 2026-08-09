import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { UpdatePreferencesDto } from './dto/preferences.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Aggregated dashboard summary (today plan, exams, focus, streaks, recommendations)',
  })
  @ApiResponse({ status: 200, description: 'Dashboard summary returned' })
  async summary(@CurrentUser() user: JwtPayload) {
    return this.service.summary(user.sub);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Dashboard preferences (e.g. hide_game_stats)' })
  async getPreferences(@CurrentUser() user: JwtPayload) {
    return this.service.getPreferences(user.sub);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update dashboard preferences' })
  async setPreferences(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePreferencesDto) {
    return this.service.setPreferences(user.sub, dto);
  }
}
