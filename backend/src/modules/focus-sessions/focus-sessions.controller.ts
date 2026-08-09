import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FocusSessionsService } from './focus-sessions.service';
import {
  StartFocusSessionDto,
  UpdateFocusSessionDto,
  CompleteFocusSessionDto,
} from './dto/focus-session.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';

@ApiTags('Focus Sessions')
@Controller('focus-sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FocusSessionsController {
  constructor(private readonly service: FocusSessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a focus session' })
  async start(@CurrentUser() user: JwtPayload, @Body() dto: StartFocusSessionDto) {
    return this.service.start(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List focus sessions' })
  async list(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.service.list(user.sub, limit ? Number(limit) : 50);
  }

  @Get('today')
  @ApiOperation({ summary: "Today's focus summary" })
  async today(@CurrentUser() user: JwtPayload) {
    return this.service.todaySummary(user.sub);
  }

  @Get('wellbeing')
  @ApiOperation({
    summary: 'Study-health status (anti-overstudy): budget, health meter, cooldown',
  })
  async wellbeing(@CurrentUser() user: JwtPayload) {
    return this.service.wellbeing(user.sub);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a running session' })
  async pause(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.pause(user.sub, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused session' })
  async resume(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.resume(user.sub, id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a session' })
  async complete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CompleteFocusSessionDto,
  ) {
    return this.service.complete(user.sub, id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update session metadata' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFocusSessionDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a session' })
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.service.delete(user.sub, id);
  }
}
