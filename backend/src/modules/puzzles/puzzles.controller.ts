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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PuzzlesService } from './puzzles.service';
import { CreatePuzzleDto, UpdatePuzzleDto, SubmitPuzzleDto } from './dto/puzzle.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common';

@ApiTags('Puzzles')
@Controller('puzzles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PuzzlesController {
  constructor(private readonly service: PuzzlesService) {}

  @Get('subjects')
  @ApiOperation({ summary: 'Per-subject puzzle overview (counts, streaks)' })
  async subjects(@CurrentUser() user: JwtPayload) {
    return this.service.listSubjects(user.sub);
  }

  @Get('attempts')
  @ApiOperation({ summary: 'Puzzle attempt history' })
  @ApiQuery({ name: 'subject', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async attempts(
    @CurrentUser() user: JwtPayload,
    @Query('subject') subject?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.attempts(user.sub, subject, limit ? Number(limit) : 100);
  }

  @Get('next')
  @ApiOperation({ summary: 'Get the next puzzle for a subject' })
  @ApiQuery({ name: 'subject', required: true })
  @ApiQuery({ name: 'mode', required: true, enum: ['ranked', 'practice'] })
  async next(
    @CurrentUser() user: JwtPayload,
    @Query('subject') subject: string,
    @Query('mode') mode: string,
  ) {
    return this.service.nextPuzzle(user.sub, subject, mode === 'ranked' ? 'ranked' : 'practice');
  }

  @Get()
  @ApiOperation({ summary: 'List puzzles (with answers, for authoring)' })
  @ApiQuery({ name: 'subject', required: false })
  async list(@CurrentUser() user: JwtPayload, @Query('subject') subject?: string) {
    return this.service.list(user.sub, subject);
  }

  @Post()
  @ApiOperation({ summary: 'Create an original puzzle' })
  @ApiResponse({ status: 201, description: 'Puzzle created' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePuzzleDto) {
    return this.service.create(user.sub, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit an answer' })
  async submit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SubmitPuzzleDto,
  ) {
    return this.service.submit(user.sub, id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a puzzle' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePuzzleDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a puzzle' })
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.service.delete(user.sub, id);
  }
}
